import { HWGW_CONSTANTS } from "../core/constants";
import { freeRamPredicate, getAllServers, RamNetwork } from "../core/coreUtils";
import { HackTimes, HWGW_StartEndTimes, HWGW_ThreadCounts, ServerSubset } from "../core/datatypes";

/**
 * Gets how long it takes to run a Hack/Grow/Weaken (without formulas)
 * 
 * @param ns 
 * @param target - target to hack/grow/weaken
 * @returns HackTimes object, with each type
 */
export function getHgwExecTimes(ns: NS, target: string): HackTimes {
    let hackTime = ns.getHackTime(target);
    return {hack: hackTime, grow: hackTime * HWGW_CONSTANTS.grow.RELATIVE_HACK_TIME, weaken: hackTime * HWGW_CONSTANTS.weaken1.RELATIVE_HACK_TIME}
}

// TODO: metric based weighting like this:
// export function GetProfitServers(ns: NS, count = 1) {
//     return getAllServers(ns)
//         .map(hostname => ns.getServer(hostname))
//         .filter(server => server.hasAdminRights && server.moneyMax > 0)
//         .map(server => GetServerMetrics(ns, server.hostname))
//         .filter(IsDefined)
//         .sort((a, b) => b.profit - a.profit)
//         .slice(0, count);
// }

/**
 * Gets the best targets for hacking. Basic approach.
 * 
 * Filters by:
 *  - Has rootAccess
 *  - Required hack level < 1/2 current hack level
 * 
 * The sorts by:
 *  - Highest max money
 * 
 * @param ns 
 * @param listLength - How many targets to have in the final list
 * @param print - boolean to display the results or not
 * @returns string[] of the server names
 */
export function getBestTargetsNaiive(ns: NS, listLength: number = 10, print = false): string[] {
    let servers: string[] = getAllServers(ns, true);
    let playerHackLevel = ns.getHackingLevel();

    // Filter first, then sort, and use the result
    const bestServers = servers
        .filter((a) => ((ns.getServerRequiredHackingLevel(a) < (playerHackLevel / 2)) && ns.hasRootAccess(a))) // Filter servers
        .sort((a, b) => ns.getServerMaxMoney(b) - ns.getServerMaxMoney(a)); // Sort by max money (descending)

    // Check if there are suitable servers
    if (print && bestServers.length > 0) {
        ns.printf(`Top ${listLength} targets:`);
        // Loop through the top x servers or fewer if the list is smaller
        for (let i = 0; i < Math.min(listLength, bestServers.length); i++) {
            const server = bestServers[i];
            ns.printf(`${i + 1}. ${server} - Max Money: ${ns.formatNumber(ns.getServerMaxMoney(server))} - Required Hacking Level: ${ns.getServerRequiredHackingLevel(server)}`);
        }
    } else if (print) {
        ns.printf("No suitable targets found for best server targets!");
    }

    bestServers.splice(listLength, bestServers.length - listLength);

    return bestServers;
}

export function getHWGWThreadCounts(ns: NS, target: string, leechPercent: number, print = false): HWGW_ThreadCounts {
    // hack is simple, just get the leech amt, floor it
    const hackThreads = Math.floor(ns.hackAnalyzeThreads(target, ns.getServerMaxMoney(target) * leechPercent));
    
    // weaken is easy as well, just account for hack increases, ceil just in case
    const weaken1Threads = Math.ceil((hackThreads * HWGW_CONSTANTS.hack.SEC_CHANGE) / HWGW_CONSTANTS.weaken1.SEC_CHANGE);
    
    // grow is trickier - get multiplier from hackThreads vs maxMoney, and ceil it to ensure growth
    const maxMoney = ns.getServerMaxMoney(target);
    const multFactor = maxMoney / (maxMoney - (maxMoney * (ns.hackAnalyze(target) * hackThreads)));
    const growThreads = Math.ceil(ns.growthAnalyze(target, multFactor)); //TODO: add extra to account for leveling?
    
    // weaken is easy as well, just account for grow increases, ceil just in case
    const weaken2Threads = Math.ceil((growThreads * HWGW_CONSTANTS.grow.SEC_CHANGE) / HWGW_CONSTANTS.weaken2.SEC_CHANGE);

    /** Old print statements */
    // const moneyPrintFrom = ns.getServerMaxMoney(target) - (ns.getServerMaxMoney(target) * leechPercent);
    // ns.print(`hackThreads: ${hackThreads} for ${ns.formatNumber(ns.getServerMaxMoney(target) * leechPercent)} (${ns.formatPercent(leechPercent)} leech, down to ${ns.formatNumber(moneyPrintFrom)})`);
    // ns.print(`weaken1Threads: ${weaken1Threads} for ${(hackThreads * HGW_TYPE.HACK.SEC_INCR)} sec incr from hack (${ns.formatNumber(HGW_TYPE.WEAKEN.SEC_DECR)} decr ea)`);
    // const moneyToPredicted = moneyPrintFrom * multFactor;
    // ns.print(`growThreads: ${growThreads} for ${multFactor} multFactor, should be from ${ns.formatNumber(moneyPrintFrom)} to ${ns.formatNumber(moneyToPredicted)}(${ns.formatNumber(ns.getServerMaxMoney(target))})`);
    // ns.print(`weaken2Threads: ${weaken2Threads} for ${(growThreads * HGW_TYPE.GROW.SEC_INCR)} sec incr from grow (${ns.formatNumber(HGW_TYPE.WEAKEN.SEC_DECR)} decr ea)`);
    // ns.print(`\n`);

    const threadCounts = new HWGW_ThreadCounts(hackThreads, weaken1Threads, growThreads, weaken2Threads);
    if (print) threadCounts.print(ns);

    return threadCounts;
}

export function getStartEndTimes(ns: NS, target: string, print = false): HWGW_StartEndTimes {
    let executionTimes = getHgwExecTimes(ns, target);
    
    const BUFFER_MS = 50;

    let startEndTimes = new HWGW_StartEndTimes();

    let longestTime = Math.max(executionTimes.hack, executionTimes.grow, executionTimes.weaken); //assuming weaken for now, will break if wrong
    let fullTime = longestTime + (BUFFER_MS * 2); //weaken1 (0start) + (grow + weaken2 buffers)

    //weaken2
    startEndTimes.weaken2.end = fullTime;
    startEndTimes.weaken2.start = fullTime - executionTimes.weaken;

    //weaken1
    startEndTimes.weaken1.end = longestTime;
    startEndTimes.weaken1.start = 0;

    //hack
    startEndTimes.hack.end = fullTime - BUFFER_MS * 3;
    startEndTimes.hack.start = startEndTimes.hack.end - executionTimes.hack;

    //grow
    startEndTimes.grow.end = fullTime - BUFFER_MS;
    startEndTimes.grow.start = startEndTimes.grow.end - executionTimes.grow;

    //print
    if (print) startEndTimes.print(ns);

    return startEndTimes
}

export function getOptimalLeechPercent(ns: NS, preppedTarget: string, subset: ServerSubset, verbose = false): {optimalLeechPercent: number; hwgwThreads: HWGW_ThreadCounts} {
    let [lowerBound, upperBound] = [0, 1];
    let optimalPercent = 0; // Tracks the last known working percentage
    let lastValidThreadCounts: HWGW_ThreadCounts;
    let lastValidRamUsage: ReturnType<typeof calculateRamUsage>;
    const ramnet = new RamNetwork(ns, subset);
    const largestFreeBlock = ramnet.getLargestFreeBlock();

    // Define the minimum interval threshold
    const threshold = 0.01;

    while (upperBound - lowerBound > threshold) {
        // Calculate the mid-point for binary search
        const midPercent = (lowerBound + upperBound) / 2;

        // Calculate thread counts and RAM usage for the current percentage
        const threadCounts = getHWGWThreadCounts(ns, preppedTarget, midPercent);
        const ramUsage = calculateRamUsage(threadCounts);
        const { maxRamBlock, ramBlockArray } = ramUsage;

        // if verbose print debug
        if (verbose) {
            ns.print(`\nChecking for optimal percent`);
            ns.print(`INFO Trying ${ns.formatPercent(midPercent)}`);
            threadCounts.print(ns);
            ns.print(`LargestFreeBlock: ${ns.formatRam(largestFreeBlock)} | MaxRamBlock: ${ns.formatRam(maxRamBlock)}`);
            ns.print(`RamBlockArray Elements:`);
            ramBlockArray.forEach(ramBlock => ns.print(`${ns.formatRam(ramBlock)}`));
        }

        if (maxRamBlock > largestFreeBlock) {
            // The largest block is too large to fit; reduce the upper bound
            if (verbose) ns.print(`INFO Largest block too big to fit, reducing upper bound`);
            upperBound = midPercent;
        } else if (!ramnet.checkRamFit(maxRamBlock, ramBlockArray, verbose)) {
            // Can't fit all blocks in the RAM network; reduce the upper bound
            if (verbose) ns.print(`INFO Can't fit all blocks, reducing upper bound`);
            upperBound = midPercent;
        } else {
            // Fits within constraints; record this as the last valid percentage
            if (verbose) ns.print(`INFO Fits! Attempting to increase`);
            lowerBound = midPercent;
            optimalPercent = midPercent; // Update the last valid percent
            lastValidThreadCounts = threadCounts; // Save thread counts for the last valid percent
            lastValidRamUsage = ramUsage; // Save RAM usage for the last valid percent
        }
    }

    // If verbose, print details of the final valid percentage
    if (verbose && lastValidThreadCounts && lastValidRamUsage) {
        ns.print(`\nFinal Optimal Percent: ${ns.formatPercent(optimalPercent)}`);
        lastValidThreadCounts.print(ns);
        ns.print(`LargestFreeBlock: ${ns.formatRam(largestFreeBlock)} | MaxRamBlock: ${ns.formatRam(lastValidRamUsage.maxRamBlock)}`);
    }

    // Return the last known valid percent
    return {optimalLeechPercent: optimalPercent, hwgwThreads: lastValidThreadCounts};
}



export function calculateRamUsage(threadCounts: HWGW_ThreadCounts): { maxRamBlock: number; minRamBlock: number; ramBlockArray: number[] } {
    // Object.keys(threadCounts).forEach(type => {
    //     const threadCount = threadCounts[type as keyof HWGW_ThreadCounts];
    //     const ramCost = threadCount * HWGW_CONSTANTS[type].RAM_COST;
    // }); //TODO
    const ramBlockArray = [
        threadCounts.hack * HWGW_CONSTANTS.hack.RAM_COST,
        threadCounts.weaken1 * HWGW_CONSTANTS.weaken1.RAM_COST,
        threadCounts.grow * HWGW_CONSTANTS.grow.RAM_COST,
        threadCounts.weaken2 * HWGW_CONSTANTS.weaken2.RAM_COST,
    ];
    
    const maxRamBlock = Math.max(...ramBlockArray);
    const minRamBlock = Math.min(...ramBlockArray);
    
    return { maxRamBlock, minRamBlock, ramBlockArray };
}