import { getHgwExecTimes } from "../hack/hackUtils";
import { HWGW_CONSTANTS } from "../core/constants";
import { disableLog, getMaximumThreads } from "../core/coreUtils";

/**
 * Grows a given server (default 'joesguns') infinitely, using maximum threads of wherever this script is run from
 * TODO: make it run from home, on a given other host
 * 
 * @param ns 
 */
export async function main(ns: NS) {
    disableLog(ns);
    const target = ns.args[0] as string || 'joesguns'; //TODO: fancy parsing via helper
    
    // set constants
    const host = ns.getHostname();
    const script = HWGW_CONSTANTS.grow.SCRIPT_LOCATION;
    const growThreadCount = getMaximumThreads(ns, script, host, Math.floor)
    const BUFFER_MS = 50

    // continually grow at max threads, and then simply sleep for that execution length (+ buffer)
    while (true) {
        ns.exec(script, host, growThreadCount, target);
        await ns.sleep(getHgwExecTimes(ns, target).GrowTime + BUFFER_MS);
    }

}