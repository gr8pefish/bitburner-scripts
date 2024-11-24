import { DIST_DIR, HGW_DIR } from "./constants";
import { MathRoundType } from "./datatypes";

/**
 * Clears and diables logging
 * @param ns 
 */
export function disableLog(ns: NS){
    ns.clearLog(); ns.disableLog('ALL');
}

/**
 * Get the maximum number of threads a given host (home by default) can run a script with.
 * Can round up or down, if supplied.
 * May return 0 (an invalid exec thread count), so beware!
 * 
 * @param ns 
 * @param scriptOrRamCost - filename of script, or the cost of the script to run
 * @param host - hostname of the server to run it on. Home if not provided
 * @param round - Math.ceil, Math.floor, or nothing
 * @returns Positive (>= 0) number of threads. Integer if rounded, otherwise float.
 */
export function getMaximumThreads(ns: NS, scriptOrRamCost: string | number, host?: string, round?: MathRoundType): number {
    if (!host) host = 'home';
    let ramCost: number
    if (typeof scriptOrRamCost === 'string') {
        ramCost = getMaximumThreads(ns, ns.getScriptRam(scriptOrRamCost, host), host, round);
    } else {
        ramCost = scriptOrRamCost;
    }
    const hostRamFree = getFreeRAM(ns, host);
    let threadCount = hostRamFree <= 0 ? 0 : hostRamFree / ramCost;
    if (round) threadCount = round(threadCount);
    return threadCount;
}

/**
 * Gets the available free ram on the target server
 * 
 * @param ns 
 * @param target - hostname of the server to check
 * @param freeRAMPercent - 0 by default, mostly useful for home
 * @returns free ram amount
 */
export function getFreeRAM(ns: NS, target: string, freeRAMPercent = 0): number {
    return (ns.getServerMaxRam(target) * (1 - freeRAMPercent)) - ns.getServerUsedRam(target)
}

/**
 * Gets root access to given server
 * 
 * @param ns 
 * @param target - hostname of the server
 * @returns boolean: success or fail
 */
export function rootServer(ns: NS, target: string): boolean {
    if (ns.hasRootAccess(target)) return true;
    try { ns.sqlinject(target); } catch(err) {}
    try { ns.httpworm(target); } catch(err) {}
    try { ns.relaysmtp(target); } catch(err) {}
    try { ns.ftpcrack(target); } catch(err) {}
    try { ns.brutessh(target); } catch(err) {}
    try { 
        ns.nuke(target);
        return true; 
    } catch(err) { 
        return false;
    }
}

/**
 * Prepares all servers
 * - Attempts to root each server
 * - Scp's all HWG/* and DIST/* files to each server
 * 
 * @param ns 
 * @param serverList - a given list of all server names, otherwise it creates it
 */
export function prepAllServers(ns: NS, serverList?: string[]) {
    const servers = serverList ? serverList : getAllServers(ns, true);
    const allFiles = ns.ls('home', DIST_DIR).concat(ns.ls('home', HGW_DIR))
    for (const server of servers) {
        rootServer(ns, server);
        for (const file of allFiles) {
            ns.scp(file, server);
        }
    }
}

/**
 * Updates all server roots, doesn't copy files like {@function prepAllServers}
 * 
 * @param ns 
 * @param serverList - a given list of all server names, otherwise it creates it
 */
export function updateServerRoots(ns: NS, serverList?: string[]) {
    const servers = serverList ? serverList : getAllServers(ns, true);
    for (const server of servers) {
        rootServer(ns, server);
    }
}

/**
 * Gets all server names, by default excludes home
 * 
 * @param ns 
 * @param removeHome 
 * @returns 
 */
export function getAllServers(ns: NS, removeHome = true): Array<string> {
	const serversSet = new Set(["home"]);
	serversSet.forEach(server => ns.scan(server).forEach(connectServer => serversSet.add(connectServer)));
	if (removeHome) serversSet.delete("home");
    // ns.printf(Array.from(x).toString());
	return Array.from(serversSet);
}

/**
 * STOLEN FROM QUACKSOULS
 * 
 * Scan all servers in the game world.  Exclude purchased servers and our home
 * server.
 *
 * @param {ns} ns The Netscript API.
 * @param {string} root Start scanning from this server.  Default is home
 *     server.
 * @param {set} visit Set of servers visited so far.  Default is empty set.
 * @returns {array<string>} Array of hostnames of world servers, excluding home
 *     and purchased servers.
 */
export function getAllServersAlt(ns: NS, root = 'home', visit = new Set()) {
    const not_pserv = (host) => !ns.getServer(host).purchasedByPlayer;
    const not_visited = (host) => !visit.has(host);
    // Use a recursive version of depth-first search.
    ns.scan(root)
        .filter(not_pserv)
        .filter(not_visited)
        .forEach((host) => {
            visit.add(host);
            getAllServersAlt(ns, host, visit);
        });
    return [...visit];
}

// const servers = ["home"];
// for (const server of servers) {
//     for (const other of ns.scan(server)) {
//         if (!servers.includes(other)) servers.push(other);
//     }
// }
// servers.shift(); // if you don't want "home" in the list

// const insertAt =
//             sortedRamHostArray.findIndex((other) => {
//                 ns.printf(`Finding Index: ${other.hostName} | ${other.freeRam} <= ${hostToFreeRam.freeRam}`);
//                 ns.printf(`Predicate matches: %s`, other.freeRam <= hostToFreeRam.freeRam);
//                 return other.freeRam <= hostToFreeRam.freeRam;
//             }) + 1;

// The recursive server navigation algorithm. The lambda predicate determines which servers to add to the final list.
// You can also plug other functions into the lambda to perform other tasks that check all servers at the same time.
/** @param {NS} ns */
// export function getServers(ns: NS, lambdaCondition = () => true, hostname = "home", servers:string[] = [], visited:string[] = []) {
// 	if (visited.includes(hostname)) return;
// 	visited.push(hostname);
// 	if (lambdaCondition(hostname)) servers.push(hostname);
// 	const connectedNodes = ns.scan(hostname);
// 	if (hostname !== "home") connectedNodes.shift();
// 	for (const node of connectedNodes) getServers(ns, lambdaCondition, node, servers, visited);
// 	return servers;
// }


//TODO: fancy parser for flags/args
// export function handleArgs(ns: NS, scriptArgs: ScriptArg[], defaults: ArgDefaults[]): ScriptArg[] {
//     type ArgDefaults = {
//         defaultValue: null | string | number | boolean;
//         errorMessage: string;
//     }
// }