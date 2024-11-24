import { ReactElement } from "@/NetscriptDefinitions";
import React from "react"

/** @param {NS} ns */
export async function main(ns: NS) {
    let elem = React.createElement("button",{onClick: () => ns.tprint("hi")}, "click me");
    ns.tprintRaw(elem);
    // ns.tprintRaw(TestElement(ns));
}

function TestElement(ns: NS): ReactElement {
    return React.createElement("button",{onClick: () => ns.tprint("hi2")}, "click me 2");
}