import { NS, ScriptArg } from "@/NetscriptDefinitions";
import { DIST_DIR, HGW_DIR } from "./constants";
import { HostToThreads, HWGW_ThreadCounts, MathRoundType, ServerRam, ServerRamNetwork, ServerSubset, serverSubsetPredicates } from "./datatypes";

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
        ramCost = ns.getScriptRam(scriptOrRamCost, host);
    } else {
        ramCost = scriptOrRamCost;
    }
    const hostRamFree = getFreeRAM(ns, host);
    let threadCount = hostRamFree <= 0 ? 0 : hostRamFree / ramCost;
    // ns.tprint(`${host}: ${threadCount}`);
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

export function getRamBlock(ns: NS, scriptName: string, threads: number) {
    return ns.getScriptRam(scriptName) * threads;
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





export namespace RamNetwork {

    function addServer(ns: NS, serverName: string) {
        const freeRam = getFreeRAM(ns, serverName);
        ServerRamNetwork.getInstance().upsert({serverName, freeRam});
    }

    export function initRamNetwork(ns: NS) {
        getAllServers(ns, false)
            .filter(serverName => {
                ns.hasRootAccess(serverName); //TODO: instead pass in predicate to getAllServers for quicker iteration
            })
            .forEach(serverName => {
                const freeRam = getFreeRAM(ns, serverName);
                ServerRamNetwork.getInstance().upsert({serverName, freeRam});
            });
        // ns.printf(ServerRamNetwork.getInstance().getPrintString(ns));
    }


    //TODO: push current for git history, then edit
    export function initRamNetworkSet(ns: NS) {
        // ns.getServer()
        // getAllServerObjects(ns, filterHasRoot)
    }

    function filterServersBySubset(subset: ServerSubset, servers: ServerRam[]): ServerRam[] {
        const predicate = serverSubsetPredicates[subset];
        return servers.filter(predicate);
    }

    function filterServersByRamMin(amount: number, servers: ServerRam[]): ServerRam[] {
        return servers.filter((server) => server.freeRam >= amount);
    }

    //TODO: convert to options param
    function filterServersByRamAndSubset(subset: ServerSubset, ramMin: number, servers: ServerRam[]): ServerRam[] {
        return filterServersByRamMin(ramMin, filterServersBySubset(subset, servers));
    }

        
    //TODO partial is irrelevant here?
    //unlikely this will work
    function execNetwork(ns: NS, scriptName: string, subsetType: ServerSubset, percentAllocation: number, options?: { verbose?: boolean, partial?: boolean} ): number[] {
        const { verbose = false, partial = false} = options || {}; //Defaults
        const pids: number[] = [];

        const ramBlockSize = ns.getScriptRam(scriptName)
        const subset = filterServersByRamAndSubset(subsetType, ramBlockSize, ServerRamNetwork.getInstance().getAllServers());
        const totalRam = getTotalRam(subset);
        const ramToFill = Math.floor(totalRam * percentAllocation);
        let filledRam = 0;
        const hostThreads: HostToThreads = new Map();
        while (filledRam <= ramToFill) {
            let serverRamToExec = ServerRamNetwork.getInstance().updateServerWithSubset(ramBlockSize, subset); //TODO: can do way more efficiently
            serverRamToExec = amalgamateServerRam(serverRamToExec);
            if (verbose) ns.printf(`Host threads chosen: ${ServerRamToString(ns, serverRamToExec)}`);
            for (const hostRam of serverRamToExec) {
                const threads = getFreeRAM(ns, hostRam.serverName) - hostRam.freeRam / ramBlockSize; // (actualFree - simulatedFree = ramToUse) / blockSize
                filledRam += hostRam.freeRam;
                hostThreads.set(hostRam.serverName, (hostThreads.get(hostRam.serverName) || 0) + threads); //update threadcount
            }
        }
        hostThreads.forEach((threads: number, hostname: string) => {
            pids.unshift(ns.exec(scriptName, hostname, threads));
        });
        return pids;

    }

    //combine same server + ram together
    function amalgamateServerRam(serverRam: ServerRam[]) {
        const serverMap = new Map<string, number>();

        // Aggregate freeRam for each serverName
        for (const server of serverRam) {
            serverMap.set(
                server.serverName,
                (serverMap.get(server.serverName) || 0) + server.freeRam
            );
        }

        // Convert the map back to an array of ServerRam objects
        return Array.from(serverMap.entries()).map(([serverName, freeRam]) => ({
            serverName,
            freeRam,
        }));
    }

    function getTotalRam(serverRam: ServerRam[]): number {
        return serverRam.reduce((total, server) => total + server.freeRam, 0);
    }

    function getThreadsFromRam(totalRam: number, ramBlock: number) {
        return totalRam / ramBlock;
    }

    // function execMultiple(ns: NS, script: string, serverType: ServerSubset, options?: { usagePercent?: number, threads?: number; partial?: boolean }) {
    //     const { usagePercent = 1, threads = 1, partial = false } = options || {}; // Default values
    //     const hostThreads: HostToThreads = RamNetwork.getHostsFromNetwork(ns, script, serverType, usagePercent, partial);
    //     hostThreads.forEach((threads: number, hostname: string) => {
    //         ns.exec(script, hostname, threads); //TODO: args
    //     });

    // }



    export function execScript(ns: NS, scriptName: string, threads: number, serverSubset: ServerSubset, options?: { verbose?: boolean, partial?: boolean} ): number[] {
        const scriptThreads = [{scriptName: scriptName, ramBlockSize: ns.getScriptRam(scriptName) * threads, threads: threads}]; //array of 1 object only
        return execScripts(ns, scriptThreads, serverSubset, options);
    }

    //TODO: implement partial

    //TODO: debug, maybe rethink underlying data structure even? just go simple {name: freeRam} ordered map?

    // Executes a set of scripts on the smallest servers possible (based on subset), and returns the pids
    // ex: RamNetwork.execMult(ns, {Const.HWG.Hack.Script_Loc, getRamBlock(threads), threads}, ServerSubset.NOT_OWNED) --> will exec hack block
    export function execScripts(ns: NS, scriptThreads: {scriptName: string, ramBlockSize: number, threads: number}[], serverSubset: ServerSubset, options?: { verbose?: boolean, partial?: boolean} ): number[] {
        const { verbose = false, partial = false} = options || {}; //Defaults
        const minRamBlock = Math.min(...scriptThreads.map(script => script.ramBlockSize));
        if (verbose) ns.printf(`${ServerRamNetwork.getInstance().getPrintString(ns)}`);
        if (verbose) ns.printf(`\n\nMin Ram: ${ns.formatRam(minRamBlock)}`);
        const pids: number[] = [];
        for (const scriptInput of scriptThreads) {
            if (verbose) ns.printf(`\n\nScript: ${scriptInput.scriptName} | Ram: ${ns.formatRam(scriptInput.ramBlockSize)} | Threads: ${ns.formatNumber(scriptInput.threads)}`);
            const subset = filterServersByRamAndSubset(serverSubset, minRamBlock, ServerRamNetwork.getInstance().getAllServers());
            if (verbose) ns.printf(`Subset: ${ServerRamToString(ns, subset)}`)
            const hostThreads = ServerRamNetwork.getInstance().updateServerWithSubset(scriptInput.ramBlockSize, subset, 1);
            if (verbose) ns.printf(`Host threads chosen: ${ServerRamToString(ns, hostThreads)}`);
            for (const hostRam of hostThreads) {
                if (verbose) ns.printf(`Attempt to exec: ${scriptInput.scriptName} on ${hostRam.serverName} with ${scriptInput.threads}`);
                pids.unshift(ns.exec(scriptInput.scriptName, hostRam.serverName, scriptInput.threads));
            }
        }
        return pids;
    }

    function ServerRamToString(ns: NS, serverRam: ServerRam[]): string {
        return serverRam
            .map(sr => `Server: ${sr.serverName}, Free RAM: ${ns.formatRam(sr.freeRam)}`)
            .join("\n");
    }

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