import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
// import * as myExtension from '../../extension';

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

suite("Extension Test Suite", () => {
    vscode.window.showInformationMessage("Start all tests.");

    // test("Sample test", () => {
    //     assert.strictEqual(-1, [1, 2, 3].indexOf(5));
    //     assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    // });

    const testDir = path.resolve("../../src/test/cases");
    const workspaceUri = vscode.Uri.file(__dirname);

    const files = fs.readdirSync(testDir);
    for (const file of files) {
        if (/^\w+\.shader$/.test(file)) {
            let testPath = path.join(testDir, file);
            let testUri = vscode.Uri.file(testPath);

            let res = path.parse(file);

            let okFilename = `${res.name}.ok${res.ext}`;
            let okPath = path.join(testDir, okFilename);
            let okContent = fs.readFileSync(okPath).toString();

            let configFilename = `${res.name}.json`;
            let configPath = path.join(testDir, configFilename);
            let configContent = fs.readFileSync(configPath).toString();
            let config = JSON.parse(configContent);

            test(`Format ${res.name}`, async () => {
                // Open workspace
                await vscode.commands.executeCommand(
                    "vscode.openFolder",
                    workspaceUri
                );
                // await delay(1000);

                // Open test shader file
                await vscode.commands.executeCommand("vscode.open", testUri);
                // await delay(1000);

                // Setup configuration
                const currentConfig = vscode.workspace.getConfiguration(
                    "unity-shader"
                );
                for (let k in config) {
                    await currentConfig.update(k, config[k]);
                }
                // await delay(1000);

                // Format
                for (let i = 0; i < 10; i++) {
                    await vscode.commands.executeCommand(
                        "editor.action.formatDocument"
                    );
                    // await delay(1000);
                }

                // Compare
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const formatted = editor.document.getText();
                    assert.equal(okContent, formatted);
                } else {
                    assert.fail("Active text editor not found");
                }
                // await delay(1000);
            });
        }
    }
});
