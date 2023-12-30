import * as vscode from "vscode";

class Attribute {
    name: string;
    type: string;
    semantic: string;
    constructor(name: string, type: string, semantic: string) {
        this.name = name;
        this.type = type;
        this.semantic = semantic;
    }
}

class Struct {
    name: string;
    attributes: Attribute[] = [];
    constructor(name: string) {
        this.name = name;
    }
    addAttribute(name: string, type: string, semantic: string) {
        this.attributes.push(new Attribute(name, type, semantic));
    }
}

function completer(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
): vscode.CompletionItem[] {
    const config = vscode.workspace.getConfiguration("unity-shader.completion");
    const result: vscode.CompletionItem[] = [];

    const isCompletionEnabled = config.get("completion.enable");

    if (isCompletionEnabled) {
        // let info = `Completer line ${position.line}, character ${position.character}`;
        // console.log(info);
        // vscode.window.showInformationMessage(info);

        const line = document.lineAt(position.line);
        const prefix = line.text.slice(0, position.character);
        // console.log("prefix", prefix);

        const reCompletion = /(^|\W)(\w+)\s*\.\s*(\w*)$/d;
        const matchCompletion = reCompletion.exec(prefix);
        if (matchCompletion) {
            const structs: Map<string, Struct> = new Map();
            const vars: Map<string, [Struct, number]> = new Map();

            const text = document.getText(
                new vscode.Range(0, 0, position.line, position.character)
            );

            // Search structs
            const reStruct =
                /(?<!\/\/[^\r\n]*)struct\s+(\w+)\s*{(([^}]|(\/\/.*[\n\r]))*)((?<!\/\/[^\r\n]*)})/dg;
            const reAttr = /(?<!\/\/[^\r\n]*)(\w+)\s+(\w+)\s*:\s*(\w+)\s*;/dg;
            let matchStruct, matchAttr;
            while ((matchStruct = reStruct.exec(text))) {
                // console.log("matchStruct", matchStruct[0]);
                const st = new Struct(matchStruct[1]);
                while ((matchAttr = reAttr.exec(matchStruct[2]))) {
                    st.addAttribute(matchAttr[2], matchAttr[1], matchAttr[3]);
                    // console.log("matchAttr", matchAttr[0]);
                }
                structs.set(st.name, st);
            }
            // console.log(structs);

            // Search variables
            for (const st of structs.values()) {
                let reVars = new RegExp(
                    /(?<!\/\/[^\r\n]*)\W/.source +
                        st.name +
                        /\s+(\w+)(?!\s*\()\W/.source,
                    "dg"
                );
                let matchVars;
                while ((matchVars = reVars.exec(text)) && matchVars.indices) {
                    const varName = matchVars[1];
                    const pair = vars.get(varName);
                    if (!pair || pair[1] < matchVars.indices[1][0]) {
                        vars.set(varName, [st, matchVars.indices[1][0]]);
                        // console.log("ScanVars", varName, ...match.indices[1]);
                    }
                }
            }
            // console.log(vars);

            // Completion
            const varName = matchCompletion[2];
            console.log("match", varName);
            const pair = vars.get(varName);
            if (pair) {
                for (const attr of pair[0].attributes) {
                    const item = new vscode.CompletionItem(attr.name);
                    item.detail = `${attr.type}: ${attr.semantic}`;
                    result.push(item);
                }
            }
        }
    }

    // return all completion items as array
    return result;
}

export default completer;
