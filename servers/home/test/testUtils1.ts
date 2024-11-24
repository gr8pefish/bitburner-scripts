// import { HWGWJob, HGW_CONSTANTS } from "../protobatcher/batcherUtils";

import { disableLog, prepAllServers } from "../core/coreUtils";

export async function main(ns: NS) {
    disableLog(ns);
    ns.tail();
    prepAllServers(ns);
}