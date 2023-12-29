// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import formatter from "./formatter";
import completer from "./completer";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('Congratulations, your extension "shaderlabformatter" is now active!');

    const disposableActivateCommand = vscode.commands.registerCommand(
        "unity-shader-formatter.activate",
        () => {
            // The code you place here will be executed every time your command is executed
            // Display a message box to the user
            vscode.window.showInformationMessage(
                "Successfully activated Unity shader formatter."
            );
        }
    );
    context.subscriptions.push(disposableActivateCommand);

    const languages = ["UnityShader", "shaderlab", "hlsl"];
    for (const lang of languages) {
        const disposableFormatter =
            vscode.languages.registerDocumentFormattingEditProvider(lang, {
                provideDocumentFormattingEdits: formatter,
            });
        context.subscriptions.push(disposableFormatter);

        const disposableCompletion =
            vscode.languages.registerCompletionItemProvider(
                lang,
                {
                    provideCompletionItems: completer,
                },
                "."
            );
        context.subscriptions.push(disposableCompletion);
    }
}

// This method is called when your extension is deactivated
export function deactivate() {}
