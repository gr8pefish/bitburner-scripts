export async function main(ns: NS) {
    ns.tprint('Deleting all scripts on server {ns.getServer().hostname}')
    let scripts = ns.ls(ns.getServer().hostname)
    scripts.forEach( s => {
            ns.rm(s)
        }
    )
}