import { disableLog } from "../core/coreUtils";
import { getBestTargetsNaiive } from "./hackUtils"

export async function main(ns: NS) {
    disableLog(ns);
    ns.tail();
    //print the best results
    getBestTargetsNaiive(ns, 10, true);
}