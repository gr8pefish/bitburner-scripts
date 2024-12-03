import { getHgwExecTimes } from "../hack/hackUtils";
import { HWGW_CONSTANTS } from "../core/constants";
import { getMaximumThreads } from "../core/coreUtils";

/**
 * Grows a given server (default 'joesguns') infinitely, using maximum threads of wherever this script is run from
 * TODO: make it run from home, on a given other host
 * 
 * @param ns 
 */
export async function main(ns: NS) {
    const target = 'joesguns'; //can change later, just such a good target
    const minifierMult = ns.args[0] as number || 1;
    
    // set constants
    const script = HWGW_CONSTANTS.grow.SCRIPT_LOCATION;
    const growThreadCount = Math.floor(getMaximumThreads(ns, script, ns.getHostname(), Math.floor) * minifierMult);
    const BUFFER_MS = 50

    // continually grow at max threads, and then simply sleep for that execution length (+ buffer)
    if (growThreadCount > 0) {
        while (true) {
            ns.run(script, growThreadCount, target);
            await ns.sleep(getHgwExecTimes(ns, target).grow + BUFFER_MS);
        }
    }

}

export function autocomplete(data, args) {
    return [...data.servers]; // This script autocompletes the list of servers.
}