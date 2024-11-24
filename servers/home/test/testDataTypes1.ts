import { HWGW_TYPES, HWGW_CONSTANTS } from "../core/constants";
import { HWGW_Job } from "../core/datatypes";


export async function main(ns: NS) {

    let batch: HWGW_Job[] = [];
    for (let i of HWGW_TYPES) {
        ns.tprint(i)
        let j = new HWGW_Job(i, 0, HWGW_CONSTANTS.grow.RAM_COST, 1, 1, 'test');
        batch.push(j);
    }

    for (let job of batch) {
        ns.tprint(job.hwgw_type)
        ns.tprint(typeof job.hwgw_type)
        // ns.exec(job.hwgw_type, job.host, job.threads, job.startTime);
    }

}