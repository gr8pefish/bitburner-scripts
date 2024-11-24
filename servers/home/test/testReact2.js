/** @param {NS} ns */
export async function main(ns) {
    ns.tprintRaw(React.createElement("button",{onClick: () => ns.tprint("hi")}, "click me"))
    return new Promise(()=> null)
}