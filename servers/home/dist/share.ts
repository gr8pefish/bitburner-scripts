import { disableLog } from "../core/coreUtils";

export async function main(ns: NS) {
    disableLog(ns);
    while (true) {
        await ns.share();
    }
}