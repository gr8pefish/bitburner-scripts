import { NS, ScriptArg, Server } from "@/NetscriptDefinitions";
import { DIST_DIR, HGW_DIR, HWGW_TYPE } from "./constants";
import { HWGW_Data, HWGW_Single_Job, Job, MathRoundType, ServerRamNetwork, ServerSubset, serverSubsetPredicates } from "./datatypes";

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
    const servers = serverList ? serverList : getAllServerNames(ns, true);
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
    const servers = serverList ? serverList : getAllServerNames(ns, true);
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
export function getAllServerNames(ns: NS, removeHome = true): Array<string> {
	const serversSet = new Set(["home"]);
	serversSet.forEach(server => ns.scan(server).forEach(connectServer => serversSet.add(connectServer)));
	if (removeHome) serversSet.delete("home");
    // ns.printf(Array.from(x).toString());
	return Array.from(serversSet);
}

// const servers = ["home"];
// for (const server of servers) {
//     for (const other of ns.scan(server)) {
//         if (!servers.includes(other)) servers.push(other);
//     }
// }
// servers.shift(); // if you don't want "home" in the list

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

//TODO: fancy parser for flags/args
// export function handleArgs(ns: NS, scriptArgs: ScriptArg[], defaults: ArgDefaults[]): ScriptArg[] {
//     type ArgDefaults = {
//         defaultValue: null | string | number | boolean;
//         errorMessage: string;
//     }
// }


/**
 * Recursively fetches all servers based on specified predicates.
 * 
 * @param {NS} ns - The Netscript API object.
 * @param {ServerSubset} subset - The subset of servers to include (e.g., NOT_OWNED, ALL_BUT_HOME).
 * @param {(server: Server) => boolean} [extraPredicate] - Additional filtering predicate (e.g., free RAM > 32).
 * @param {string} [hostname="home"] - Starting server hostname for the recursive search.
 * @param {Set<string>} [visited=new Set()] - Tracks visited servers to prevent loops.
 * @returns {Server[]} - An array of Server objects matching the predicates.
 */
export function getServerObjects(
    ns: NS,
    subset: ServerSubset = ServerSubset.ALL,
    extraPredicate: (server: Server) => boolean = () => true,
    hostname: string = "home",
    visited: Set<string> = new Set()
): Server[] {
    // If the server has already been visited, skip it
    if (visited.has(hostname)) return [];

    // Mark this server as visited
    visited.add(hostname);

    // Fetch the server object
    const server = ns.getServer(hostname);

    // Combine predicates
    const subsetPredicate = serverSubsetPredicates[subset];
    const combinedPredicate = (server: Server) => subsetPredicate(server) && extraPredicate(server);

    // Collect servers that match the combined predicate
    const result = combinedPredicate(server) ? [server] : [];

    // Recurse into connected servers
    const connectedNodes = ns.scan(hostname);
    for (const node of connectedNodes) {
        result.push(...getServerObjects(ns, subset, extraPredicate, node, visited));
    }

    return result;
}

/**
 * Generates a predicate to filter servers by free RAM.
 * Use caution when using with ServerRamNetwork, due to simulated (though most use cases should be covered automatically now).
 * @param {number} minFreeRam - Minimum free RAM in GB.
 * @returns {(server: Server) => boolean} - A predicate function.
 */
export function freeRamPredicate(minFreeRam: number): (server: Server) => boolean {
    return (server: Server) => server.maxRam - server.ramUsed >= minFreeRam;
}

//TODO: do optimized case for just one server, instead of whole network (i.e. reduce)
export class RamNetwork {

    private ns: NS; //for simpler external methods
    private network: ServerRamNetwork;

    public constructor(ns: NS, subset?: ServerSubset, extraPredicate?: (server: Server) => boolean) {
        const serverList = getServerObjects(ns, subset, extraPredicate);
        this.network = new ServerRamNetwork(serverList);
        this.ns = ns;
    }

    //assumes that threads * scriptName is <= than the current filtering
    //TODO: remove host call, use hostname instead?
    private execute(hostname = this.network.getNextDirectly().hostname, scriptName: string, threads: number, args: ScriptArg[], removeSimulated = true): number {
        const host = this.ns.getServer(hostname);
        // Error checking/printing
        if ((host.maxRam - host.ramUsed) < this.ns.getScriptRam(scriptName) * threads) { 
            throw Error(`ERROR Not enough RAM to exec on the given script!\n${host.hostname} | ${scriptName}\n Free RAM: ${this.ns.formatRam(host.maxRam - host.ramUsed)} | Needs: ${this.ns.getScriptRam(scriptName) * threads})`);
        }
        this.ns.printf(`INFO Attempt to exec:\n${host.hostname} | ${scriptName} | Threads: ${threads} | Free RAM: ${this.ns.formatRam(host.maxRam - host.ramUsed)} | Needs: ${this.ns.formatRam(this.ns.getScriptRam(scriptName, host.hostname) * threads)}`);
        
        // Call exec
        const pid = this.ns.exec(scriptName, host.hostname, threads, ...args);

        // Update the network
        const updatedServerObject = this.ns.getServer(host.hostname);
        this.network.updateAfterExec(updatedServerObject, removeSimulated); //should re-sort too

        return pid;
    }

    public execNetworkPercent(scriptName: string, percentFreeRamUsage: number): number {
        const scriptRamUsage = this.ns.getScriptRam(scriptName);
        const totalFreeRam = this.network.getAllServersRaw().reduce((total, server) => total + this.network.getEffectiveFreeRam(server), 0);
        const usedRam = 0;
        const ramToFill = Math.floor(totalFreeRam * percentFreeRamUsage);
        while (usedRam <= ramToFill) {
            //TODO: need to simulate usage to not have a ton of 1threads
        }
        return -1;
    }

    //Assumes ramBlockSize is the same for all
    public getTotalThreadsPossible(ramBlockSize: number): number {
        const totalThreads = this.network.getAllServersRaw().reduce((total, server) => total + Math.floor(this.network.getEffectiveFreeRam(server) / ramBlockSize), 0);
        return totalThreads;
    }

    public execNetworkIterative(job: Job, totalThreads: number, options?: { mergeThreads?: boolean, partialHosts?: boolean; verbose?: boolean }): number[] {
        const { mergeThreads = true, partialHosts = false, verbose = false } = options || {};
        const pids: number[] = [];
        const scriptRamUsage = job.getRamBlockSize(this.ns);

        let usedThreads = 0;
        let jobs: Job[] = [];

        while (usedThreads < totalThreads) {
            const threadsToFill = totalThreads - usedThreads;
            const nextServer = this.network.getNextDirectly();
            if (!nextServer) {
                break; //no more servers to fill, full on ram!
            }
            const threadsPossible = Math.floor(this.network.getEffectiveFreeRam(nextServer) / scriptRamUsage);
            const threadsActual = threadsPossible > threadsToFill ? threadsToFill : threadsPossible;
            usedThreads += threadsActual;
            jobs.push(new Job(job.getScriptName(), threadsActual, job.getArgs(), nextServer.hostname));
            this.network.addSimulated(nextServer.hostname, threadsActual * scriptRamUsage);
        }

        if (mergeThreads) {
            if (verbose) this.ns.print("Before merge:"); jobs.forEach(j => j.print(this.ns));
            jobs = this.mergeJobThreads(jobs);
            if (verbose) this.ns.print("After merge:"); jobs.forEach(j => j.print(this.ns));
        }

        for (const job of jobs) {
            const pid = this.execute(job.getHostname(), job.getScriptName(), job.getThreadCount(), job.getArgs()); //exec on the found host(s)
            pids.push(pid);
        }

        this.ns.print(`Found ${usedThreads} threads of ${totalThreads} total for ${job.getScriptName()}`);

        return pids;
    }

    public execNetwork(job: Job, options?: { mergeThreads?: boolean, partialHosts?: boolean; verbose?: boolean }): number {
        const { mergeThreads = true, partialHosts = false, verbose = false } = options || {};
        return this.execNetworkMultiple([job], {mergeThreads, partialHosts, verbose})[0];
    }

    public execNetworkMultiple(jobs: Job[], options?: { mergeThreads?: boolean, partialHosts?: boolean; verbose?: boolean }): number[] {
        const { mergeThreads = true, partialHosts = false, verbose = false } = options || {};
        const pids: number[] = [];
        for (const job of jobs) { //for each job
            if (verbose) job.print(this.ns);
            const ramBlockSize = job.getRamBlockSize(this.ns);
            if (partialHosts) {
                //TODO: partial, can also introduce multiple pids so account for that //get best multiple hosts to fit that ramBlock
                // let jobHostNames: string[] = [];
            } else {
                const host = this.network.getNextMatching(freeRamPredicate(ramBlockSize)); //get the best single host that can fit that ramBlock
                if (!host) {
                    this.ns.printf(`WARN NO HOSTS FOUND! Need network with a free block of ${this.ns.formatRam(ramBlockSize)}`)
                } else {
                    job.setHostname(host.hostname);
                    if (verbose) {
                        this.ns.printf(`INFO Found ${host.hostname} with ${this.ns.formatRam(this.network.getEffectiveFreeRam(host))} free, to fill the block of ${this.ns.formatRam(ramBlockSize)}`);
                        this.ns.printf("Setting simulated (+ re-ordering):");
                        this.network.addSimulated(host.hostname, ramBlockSize);
                        this.ns.printf("New order:");
                        this.print();
                    }
                }
            }
        }

        
        if (mergeThreads) {
            if (verbose) this.ns.print("Before merge:"); jobs.forEach(j => j.print(this.ns));
            jobs = this.mergeJobThreads(jobs);
            if (verbose) this.ns.print("After merge:"); jobs.forEach(j => j.print(this.ns));
        }

        for (const job of jobs) {
            const pid = this.execute(job.getHostname(), job.getScriptName(), job.getThreadCount(), job.getArgs()); //exec on the found host(s)
            pids.push(pid);
        }

        return pids;

    }

    private mergeJobThreads(jobs: (Job | HWGW_Single_Job)[], verbose = false): (Job | HWGW_Single_Job)[] {
        const hostMap = new Map<
            string, // Composite key: hostname + job-specific properties
            {
                threads: number;
                args: ScriptArg[];
                scriptName: string;
                jobType: "Job" | "HWGW_Single_Job";
                additionalProps?: {
                    hwgw_type?: HWGW_TYPE;
                    targetServer?: string;
                    startTime?: number;
                    endTime?: number;
                };
            }
        >();
    
        for (const job of jobs) {
            const hostname = job.getHostname();
            if (!hostname) continue; // Skip jobs without a hostname
    
            // Generate a composite key for the job
            const compositeKey =
                hostname +
                (job instanceof HWGW_Single_Job
                    ? `|${job.getHWGWtype()}|${job.getTargetServer()}|${job.getTimeStart()}|${job.getTimeEnd()}`
                    : "");
    
            const existing = hostMap.get(compositeKey);
    
            if (existing) {
                // Merge threads for matching jobs
                if (verbose) {
                    this.ns.print(`Merging threads for: ${hostname}`);
                    job.print(this.ns);
                }
                existing.threads += job.getThreadCount();
            } else {
                // Add a new entry to the map
                hostMap.set(compositeKey, {
                    threads: job.getThreadCount(),
                    args: job.getArgs(),
                    scriptName: job.getScriptName(),
                    jobType: job instanceof HWGW_Single_Job ? "HWGW_Single_Job" : "Job",
                    additionalProps: job instanceof HWGW_Single_Job
                        ? {
                              hwgw_type: job.getHWGWtype(),
                              targetServer: job.getTargetServer(),
                              startTime: job.getTimeStart(),
                              endTime: job.getTimeEnd(),
                          }
                        : undefined,
                });
            }
        }
    
        // Convert the map back to an array of Job or HWGW_Single_Job objects
        return Array.from(hostMap.entries()).map(([compositeKey, { threads, args, scriptName, jobType, additionalProps }]) => {
            const hostname = compositeKey.split("|")[0]; // Extract hostname
            if (jobType === "HWGW_Single_Job" && additionalProps) {
                // Recreate an HWGW_Single_Job instance
                const data = new HWGW_Data();
                data.setTimes(additionalProps.hwgw_type!, additionalProps.startTime!, additionalProps.endTime!);
                data.setThreads(additionalProps.hwgw_type!, threads);
    
                return new HWGW_Single_Job(
                    scriptName,
                    additionalProps.hwgw_type!,
                    data,
                    additionalProps.targetServer!,
                    hostname
                );
            } else {
                // Recreate a generic Job instance
                return new Job(scriptName, threads, args, hostname);
            }
        });
    }
    
    

    public checkRamFit(minRamBlock: number, ramBlockArray: number[], verbose = false): boolean {
        const hostsSimulated = [];
        // loop through all ramBlocks
        for (const ramBlock of ramBlockArray) {
            const host = this.network.getNextMatching(freeRamPredicate(ramBlock))
            if (!host) {
                // can't fit them all, remove simulated and return false (TODO: wrong?)
                if (verbose) this.ns.print(`RamFit FAIL: Can't fit ${this.ns.formatRam(ramBlock)} in any simulated host`);
                hostsSimulated.forEach(host => this.network.removeSimulated(host));
                return false;
            } else {
                this.network.addSimulated(host.hostname, ramBlock);
            }
        }

        //made it through, remove simulated and return true
        if (verbose) this.ns.print(`RamFit SUCCESS: Fit all ramBlocks in simulated hosts`);
        hostsSimulated.forEach(host => this.network.removeSimulated(host));
        return true;

        //TODO: optimize for only checking >= smallestRamSize block, maybe also remove -1 and ramBlockArray.max as it'll be full by largestRamBlock already
        // this.network.setSubset(freeRamPredicate(minRamBlock))//modifies in place, need to restore base via addMultiple later //TODO: just have it get copy later
        // this.network.addMultiple(getServerObjects(this.ns, ServerSubset.ALL)); //restore to base

    }

    public getLargestFreeBlock() {
        return this.network.getEffectiveFreeRam(this.network.getLastDirectly());
    }

    public updateDefaultFilterPredicateMinRam(minRam) {
        this.network.updateDefaultFilterPredicate((server: Server) => server.hasAdminRights && this.network.getEffectiveFreeRam(server) >= minRam);
    }

    print() {
        this.ns.printf(this.network.toPrintString(this.ns))
    }

}