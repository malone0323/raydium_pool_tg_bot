const { Connection, PublicKey } = require('@solana/web3.js');
const { Market } = require('@project-serum/serum');
const { TokenAmount, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { Liquidity, Token, LIQUIDITY_STATE_LAYOUT_V4 } = require('@raydium-io/raydium-sdk');
const axios = require('axios');
const BN = require('bn.js');
require('dotenv').config();

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DEFAULT_POOL_ADDRESS = process.env.RAYDIUM_POOL_ADDRESS;
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

async function fetchPoolData(poolAddress) {
    try {
        console.log(DEFAULT_POOL_ADDRESS, SOLANA_RPC_URL, 'fetchPoolData');
        const account = await connection.getAccountInfo(new PublicKey(poolAddress));
        if (!account) {
            throw new Error('Pool account not found');
        }
        return LIQUIDITY_STATE_LAYOUT_V4.decode(account.data);
    } catch (error) {
        console.error('Error fetching pool data:', error);
        throw error;
    }
}

async function getTokenInfo(poolAddress) {
    try {
        const tokenInfo = {
            tokenAddress: '',
            devAddress: '',
            devHoldings: 0,
            solPrice: 0,
            tokenPrice: 0,
            hourlyVolume: 0,
            numHolders: 0,
            holdersDistribution: {
                top10: 0,
                top25: 0,
                top50: 0,
                top100: 0
            },
            devHoldingsLive: 0,
            creatorHoldingsLive: 0,
            mainPairAddress: poolAddress
        };

        // Fetch pool data
        console.log('Fetching pool data...');
        const poolData = await fetchPoolData(poolAddress);
        
        // Get token addresses
        tokenInfo.tokenAddress = poolData.baseMint.toBase58();
        const quoteMint = poolData.quoteMint.toBase58();
        
        console.log('Base Token:', tokenInfo.tokenAddress);
        console.log('Quote Token:', quoteMint);

        // Get SOL price from CoinGecko
        try {
            const solPriceResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            tokenInfo.solPrice = solPriceResponse.data.solana.usd;
            console.log('SOL Price:', tokenInfo.solPrice);
        } catch (error) {
            console.warn('Warning: Could not fetch SOL price', error.message);
        }

        // Calculate token price from pool reserves
        try {
            const baseReserve = new BN(poolData.baseReserve.toString());
            const quoteReserve = new BN(poolData.quoteReserve.toString());
            const baseDecimals = 9; // Most Solana tokens use 9 decimals
            const quoteDecimals = 9;

            const baseAmount = baseReserve.div(new BN(10 ** baseDecimals));
            const quoteAmount = quoteReserve.div(new BN(10 ** quoteDecimals));
            
            if (!baseAmount.isZero()) {
                tokenInfo.tokenPrice = (quoteAmount.toNumber() / baseAmount.toNumber()) * tokenInfo.solPrice;
                console.log('Calculated token price:', tokenInfo.tokenPrice);
            }
        } catch (error) {
            console.warn('Warning: Could not calculate token price', error.message);
        }

        // Get token holders from Solscan
        try {
            console.log('Fetching holder information...');
            const response = await axios.get(`https://public-api.solscan.io/token/holders?tokenAddress=${tokenInfo.tokenAddress}`);
            
            if (response.data && response.data.data) {
                const holders = response.data.data;
                tokenInfo.numHolders = response.data.total;

                if (holders.length > 0) {
                    const totalSupply = holders.reduce((acc, holder) => acc + parseFloat(holder.amount), 0);
                    
                    // Calculate holdings distributions
                    function calculateTopHoldersPercentage(topN) {
                        return holders
                            .slice(0, Math.min(topN, holders.length))
                            .reduce((acc, holder) => acc + (parseFloat(holder.amount) / totalSupply) * 100, 0)
                            .toFixed(2);
                    }

                    tokenInfo.holdersDistribution = {
                        top10: calculateTopHoldersPercentage(10),
                        top25: calculateTopHoldersPercentage(25),
                        top50: calculateTopHoldersPercentage(50),
                        top100: calculateTopHoldersPercentage(100)
                    };

                    // Get dev info (assuming largest holder is dev)
                    if (holders[0]) {
                        tokenInfo.devAddress = holders[0].owner;
                        tokenInfo.devHoldings = holders[0].amount;
                        tokenInfo.devHoldingsLive = holders[0].amount;
                    }

                    // Get creator holdings (assuming second largest holder)
                    if (holders[1]) {
                        tokenInfo.creatorHoldingsLive = holders[1].amount;
                    }
                }
            }
        } catch (error) {
            console.warn('Warning: Could not fetch holder information', error.message);
        }

        // Get 24h volume from Raydium API
        try {
            const volumeResponse = await axios.get('https://api.raydium.io/v2/main/pairs');
            const pairInfo = volumeResponse.data.find(pair => 
                pair.ammId.toLowerCase() === poolAddress.toLowerCase()
            );
            
            if (pairInfo) {
                tokenInfo.hourlyVolume = pairInfo.volume24h / 24;
                console.log('Hourly volume:', tokenInfo.hourlyVolume);
            }
        } catch (error) {
            console.warn('Warning: Could not fetch volume information', error.message);
        }

        console.log('\nToken Information:');
        console.log(JSON.stringify(tokenInfo, null, 2));
        return tokenInfo;

    } catch (error) {
        console.error('Error fetching token info:', error.message);
        throw error;
    }
}

// Main execution logic
async function main() {
    const args = process.argv.slice(2);
    const watchMode = args.includes('--watch');
    let poolAddress = DEFAULT_POOL_ADDRESS;

    // Check for pool address in arguments
    const poolIndex = args.indexOf('--pool');
    if (poolIndex !== -1 && args[poolIndex + 1]) {
        poolAddress = args[poolIndex + 1];
    }

    if (!poolAddress) {
        console.error('Please provide a pool address either in .env file or using --pool argument');
        console.error('Usage: npm run track -- --pool YOUR_POOL_ADDRESS');
        console.error('   or: Add RAYDIUM_POOL_ADDRESS in .env file and run npm start');
        process.exit(1);
    }

    if (watchMode) {
        console.log(`Watching pool ${poolAddress} for updates...`);
        // Update every 30 seconds
        setInterval(async () => {
            console.log('\n--- Updating token information ---');
            await getTokenInfo(poolAddress);
        }, 30000);
        
        // Initial fetch
        await getTokenInfo(poolAddress);
    } else {
        await getTokenInfo(poolAddress);
    }
}

// Run the main function
if (require.main === module) {
    main().catch(console.error);
}
