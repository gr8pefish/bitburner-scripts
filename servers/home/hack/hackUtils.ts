import { HWGW_CONSTANTS } from "../core/constants";
import { getAllServers } from "../core/coreUtils";
import { HackTimes } from "../core/datatypes";

/**
 * Gets how long it takes to run a Hack/Grow/Weaken (without formulas)
 * 
 * @param ns 
 * @param target - target to hack/grow/weaken
 * @returns HackTimes object, with each type
 */
export function getHgwExecTimes(ns: NS, target: string): HackTimes {
    let hackTime = ns.getHackTime(target);
    return {HackTime: hackTime, GrowTime: hackTime * HWGW_CONSTANTS.grow.RELATIVE_HACK_TIME, WeakenTime: hackTime * HWGW_CONSTANTS.weaken1.RELATIVE_HACK_TIME}
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
    } else {
        ns.printf("No suitable targets found for best server targets!");
    }
    return bestServers;
}



