const { spawn } = require("child_process");

function run(name, command, args, cwd) {
    const process = spawn(command, args, {
        cwd,
        shell: true,
        stdio: "inherit",
    });

    process.on("close", (code) => {
        console.log(`${name} exited with code ${code}`);
    });

    console.log(`${name} started at ${cwd}`);
}

console.log("🚀 Starting all dev services...\n");

run("Frontend", "npm", ["run", "dev"], "./frontend");
run("Backend", "node", ["app.js"], "./backend/src");
run("AI Proctoring", "python", ["main.py"], "./ai-proctoring/src");
run("Smart Agent", "node", ["verification_agent.js"], "./smart-agent/agent");