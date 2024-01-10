<?php

function getTokenInfo($poolAddress) {
    // Execute the Node.js script and capture the output
    $command = "node tokenTracker.js " . escapeshellarg($poolAddress);
    $output = shell_exec($command);
    
    // Parse the JSON output
    $tokenInfo = json_decode($output, true);
    
    return $tokenInfo;
}

// Example usage:
/*
$poolAddress = "YOUR_POOL_ADDRESS";
$tokenInfo = getTokenInfo($poolAddress);

if ($tokenInfo) {
    echo "Token Address: " . $tokenInfo['tokenAddress'] . "\n";
    echo "Dev Address: " . $tokenInfo['devAddress'] . "\n";
    echo "Dev Holdings: " . $tokenInfo['devHoldings'] . "\n";
    echo "SOL Price: $" . $tokenInfo['solPrice'] . "\n";
    echo "Token Price: $" . $tokenInfo['tokenPrice'] . "\n";
    echo "1h Volume: $" . $tokenInfo['hourlyVolume'] . "\n";
    echo "Number of Holders: " . $tokenInfo['numHolders'] . "\n";
    echo "Top 10 Holders: " . $tokenInfo['holdersDistribution']['top10'] . "%\n";
    echo "Top 25 Holders: " . $tokenInfo['holdersDistribution']['top25'] . "%\n";
    echo "Top 50 Holders: " . $tokenInfo['holdersDistribution']['top50'] . "%\n";
    echo "Top 100 Holders: " . $tokenInfo['holdersDistribution']['top100'] . "%\n";
    echo "Dev Holdings (Live): " . $tokenInfo['devHoldingsLive'] . "\n";
    echo "Creator Holdings (Live): " . $tokenInfo['creatorHoldingsLive'] . "\n";
    echo "Main Pair Address: " . $tokenInfo['mainPairAddress'] . "\n";
}
*/
?>
