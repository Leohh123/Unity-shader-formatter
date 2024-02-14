import * as vscode from "vscode";

interface IFormatter {
    (
        document: vscode.TextDocument,
        config: vscode.WorkspaceConfiguration
    ): Result;
}

class Insert {
    line: number;
    index: number;
    data: string;
    flag: number;

    constructor(line: number, index: number, data: string, flag: number) {
        this.line = line;
        this.index = index;
        this.data = data;
        this.flag = flag;
    }

    static compare(a: Insert, b: Insert): number {
        if (a.line !== b.line) {
            return a.line - b.line;
        }
        return a.index - b.index;
    }
}

class Delete {
    lineStart: number;
    lineEnd: number;
    start: number;
    end: number;
    flag: number;

    constructor(
        lineStart: number,
        lineEnd: number,
        start: number,
        end: number,
        flag: number
    ) {
        this.lineStart = lineStart;
        this.lineEnd = lineEnd;
        this.start = start;
        this.end = end;
        this.flag = flag;
    }

    static compare(a: Delete, b: Delete): number {
        let res = Insert.compare(a.startPos(), b.startPos());
        if (res !== 0) {
            return res;
        }
        // TODO: use the following line if cannot merge deletes
        // return Insert.compare(b.endPos(), a.endPos());
        return Insert.compare(a.endPos(), b.endPos());
    }

    startPos(): Insert {
        return new Insert(this.lineStart, this.start, "", this.flag);
    }

    endPos(): Insert {
        return new Insert(this.lineEnd, this.end, "", this.flag);
    }
}

let globalFlag = 0;

class Result {
    inserts: Insert[] = [];
    deletes: Delete[] = [];

    ins(line: number, index: number, data: string) {
        if (data.length) {
            this.inserts.push(new Insert(line, index, data, globalFlag));
        }
    }

    del(line: number, start: number, end: number) {
        // Set end = -1 to delete EOL
        if (start < end) {
            this.deletes.push(new Delete(line, line, start, end, globalFlag));
        } else if (end === -1) {
            this.deletes.push(new Delete(line, line + 1, start, 0, globalFlag));
        }
    }

    rep(line: number, start: number, end: number, data: string) {
        this.ins(line, start, data);
        this.del(line, start, end);
    }

    extend(other: Result) {
        this.inserts.push(...other.inserts);
        this.deletes.push(...other.deletes);
    }

    setup() {
        this.inserts.sort(Insert.compare);
        this.deletes.sort(Delete.compare);

        let lastPos = new Insert(0, 0, "", -1);
        let newDeletes: Delete[] = [];
        for (let d of this.deletes) {
            if (Insert.compare(lastPos, d.startPos()) <= 0) {
                newDeletes.push(d);
                lastPos = d.endPos();
                // TODO: use the following line if bug exists
                // } else if (lastPos.flag === d.flag) {
            } else {
                let last = newDeletes.pop() as Delete;
                newDeletes.push(
                    new Delete(
                        last.lineStart,
                        d.lineEnd,
                        last.start,
                        d.end,
                        d.flag
                    )
                );
                lastPos = d.endPos();
            }
        }

        this.deletes = newDeletes;
    }
}

const formatForward: IFormatter = (document, config) => {
    const result: Result = new Result();

    let match, re;

    const isUseTabs = config.get("indent.use-tabs") as boolean;
    const indentSize = config.get("indent.size") as number;
    const isIfMacroIndent = config.get("indent.if-macro") as boolean;
    const isMacroIndent = config.get("indent.macro") as boolean;
    const isBraceNewline = config.get("brace.newline") as boolean;
    const isSpaceProperties = config.get("space.properties") as boolean;
    const isSpaceComment = config.get("space.comment") as boolean;
    let isLastSlash = false;
    let isInString = false;
    let indentCount = 0;
    let isAfterNonBraceIndent = false;
    let afterNonBraceIndentCount = 0;
    let afterNonBraceIndentMax = 0;
    let lastAfterNonBraceIndentCount = 0;
    let lastAfterNonBraceIndentMax = 0;
    let isLastSpace = false;

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text;

        // Empty line
        if (line.isEmptyOrWhitespace) {
            result.del(i, 0, text.length);
            continue;
        }

        // Disable formatting
        if (/disable-usf$/.test(text)) {
            result.rep(
                i,
                0,
                line.firstNonWhitespaceCharacterIndex,
                (isUseTabs ? "\t" : " ").repeat(indentSize * indentCount)
            );
            continue;
        }
        if (/disable-usf-all$/.test(text)) {
            continue;
        }

        // Indent
        let indentDelta = 0;
        let indentThis = indentCount;
        // For macros
        if (/^\s*#\w+/.test(text)) {
            if (isIfMacroIndent && /#if(n?def)?/.test(text)) {
                indentDelta++;
            } else if (isIfMacroIndent && /#el((se)|(if))/.test(text)) {
                indentThis = indentCount - 1;
            } else if (isIfMacroIndent && /#endif/.test(text)) {
                indentDelta--;
                indentThis = indentCount - 1;
            }
            if (!isMacroIndent) {
                indentThis = 0;
            }
        } else {
            /**
             * For after non-brace indent. e.g.:
             * if (condition)
             *     if (condition) {
             *         ...
             *     }
             */

            // Recover from non-brace indent
            if (
                !isAfterNonBraceIndent &&
                afterNonBraceIndentMax &&
                indentCount <= afterNonBraceIndentMax
            ) {
                indentCount -= afterNonBraceIndentCount;
                indentThis -= afterNonBraceIndentCount;
                afterNonBraceIndentCount = 0;
                afterNonBraceIndentMax = 0;
            }

            // Non-brace indent
            if (isAfterNonBraceIndent) {
                // Exclude fake non-brace indent
                if (/^\s*{/.test(text)) {
                    indentDelta--;
                    indentThis--;
                    afterNonBraceIndentCount = lastAfterNonBraceIndentCount;
                    afterNonBraceIndentMax = lastAfterNonBraceIndentMax;
                }
                isAfterNonBraceIndent = false;
            }

            // Non-brace indent trigger
            const reWithPars =
                /(?<!\/\/.*)(^|[^\w])((if)|(for)|(while))\s*\(.*\)\s*$/;
            const reNoPars = /(?<!\/\/.*)(^|[^\w])((else)|(do))\s*$/;
            if (reWithPars.test(text) || reNoPars.test(text)) {
                lastAfterNonBraceIndentCount = afterNonBraceIndentCount;
                lastAfterNonBraceIndentMax = afterNonBraceIndentMax;

                indentDelta++;
                afterNonBraceIndentCount++;
                afterNonBraceIndentMax = indentCount + 1;
                isAfterNonBraceIndent = true;
            } else {
                // For other statements
                isLastSlash = false;
                isLastSpace = false;
                for (let j = 0; j < text.length; j++) {
                    const ch = text[j];
                    if (ch === '"') {
                        isInString = !isInString;
                    }
                    if (!isInString) {
                        if (ch === "/") {
                            if (isLastSlash) {
                                break;
                            }
                            isLastSlash = true;
                        } else if (ch === "{") {
                            indentDelta++;
                        } else if (ch === "}") {
                            indentDelta--;
                        } else if (ch === " " && isLastSpace) {
                            // Remove 2+ spaces
                            result.del(i, j, j + 1);
                        }
                        if (indentDelta < 0) {
                            indentThis = indentCount - 1;
                        }
                    }
                    isLastSpace = ch === " ";
                }
            }
        }
        let indentStr = (isUseTabs ? "\t" : " ").repeat(
            indentSize * indentThis
        );
        // 1 space indent for single `{` line if !isBraceNewline
        if (!isBraceNewline && /^(\s*){/d.test(text)) {
            indentStr = " ";
        }
        result.rep(i, 0, line.firstNonWhitespaceCharacterIndex, indentStr);
        indentCount += indentDelta;

        // Brace newline
        if (isBraceNewline) {
            re = /\S(\s*){(\s*)([^}\s][^}]*)?$/dg;
            let indentBrace = indentThis;
            while ((match = re.exec(text)) && match.indices) {
                // Replace e.g.: if (condition)<space to newline>{
                result.rep(
                    i,
                    match.indices[1][0],
                    match.indices[1][1],
                    "\n" +
                        (isUseTabs ? "\t" : " ").repeat(
                            indentSize * indentBrace
                        )
                );
                // Replace e.g.: if (condition) {<space to newline>code
                if (match.indices[3]) {
                    result.rep(
                        i,
                        match.indices[2][0],
                        match.indices[2][1],
                        "\n" +
                            (isUseTabs ? "\t" : " ").repeat(
                                indentSize * (indentBrace + 1)
                            )
                    );
                }
                indentBrace++;
            }
        }

        // Add spaces
        // Case: word<SPACE>{
        if (isBraceNewline) {
            re = /\S((\?|:)|({(?=.*})))/dg;
        } else {
            re = /\S({|\?|:)/dg;
        }
        while ((match = re.exec(text)) && match.indices) {
            result.ins(i, match.indices[1][0], " ");
        }
        // Case: {<SPACE>word
        re = /({|\?|:)[^}\s]/dg;
        while ((match = re.exec(text)) && match.indices) {
            result.ins(i, match.indices[1][0] + 1, " ");
        }
        // Case: word<SPACE>}
        re = /[^{\s](})/dg;
        while ((match = re.exec(text)) && match.indices) {
            result.ins(i, match.indices[1][0], " ");
        }

        let reBase;
        // Case: word<SPACE><OPERATOR>
        reBase =
            /(?<!\/\/.*)\S(((?<![\(\[+])\+(?!\+))|((?<![\(\[-])-(?!-))|[*%\^]|((?<!\/)\/(?!\/))|((?<!&)&)|((?<!\|)\|)|(<<)|(>>)|(!=)|((?<![!%&*+\-/<=>^|])=)|((?<=\(.*)(((?<!<)<)|((?<!>)>))))/dg;
        /**
         * Explanation:
         * Not after comments and not in strings
         * There is leading \S and operator group begin
         * Operator+ with sp-cases: `if(+1)` AND `arr[+1]` AND TWO+ IN `i++`
         * Operator- same as above
         * Operator* % ^ have no special cases
         * Operator/ with sp-cases: TWO/ IN `//comment`
         * Operator& && with sp-cases: 2ND& IN `cond1 && cond2`
         * Operator| || same as above
         * Operator<< >> have no special cases
         * Operator= == != <= >= += -= *= /= %= &= |= ^= <<= >>= with sp-cases: 2ND= IN `==`
         * Operator< > could be added with space only in (), with sp-cases: 2ND< IN `<<` AND `Texture3D<float>`
         * Operator group end
         */
        re = new RegExp(/(?<!".*)/.source + reBase.source, "dg");
        while ((match = re.exec(text)) && match.indices) {
            result.ins(i, match.indices[1][0], " ");
        }
        re = new RegExp(reBase.source + /(?!.*")/.source, "dg");
        while ((match = re.exec(text)) && match.indices) {
            result.ins(i, match.indices[1][0], " ");
        }
        // Case: <OPERATOR><SPACE>word (not in strings)
        reBase =
            /(?<!\/\/.*)(((((?<![!%&*+\-/<=>^|([,]\s*)((\+(?!\+))|(-(?!-))))|[*%\^=]|((?<!\/)\/(?!\/))|(&(?!&))|(\|(?!\|))|(<(?!<))|(>(?!>)))(?!=)))\S/dg;
        /**
         * Explanation:
         * Not after comments and not in strings
         * There is trailing \S and operator group begin
         * Operator+ with sp-cases: 1ST+ IN `i++` AND `x += +12 - (+34)` AND (a, +b) AND `x+1`
         * Operator- same as above
         * Operator* % ^ = <= >= == != += -= *= /= %= &= |= ^= <<= >>= have no special cases (except `*=` case)
         * Operator/ with sp-cases: TWO/ IN `//comment`
         * Operator& && with sp-cases: 1ST& IN `a && b`
         * Operator| || same as above
         * Operator<< same as above
         * Operator>> same as above
         * Operator< > could be added with space only in (), with sp-cases: 1ST< IN `<<` AND `Texture3D<float>`
         * Each of the above operators has a special case: `<OPERATOR>=`
         * Operator group end
         */
        re = new RegExp(/(?<!".*)/.source + reBase.source, "dg");
        while ((match = re.exec(text)) && match.indices) {
            result.ins(i, match.indices[1][1], " ");
        }
        re = new RegExp(reBase.source + /(?!.*")/.source, "dg");
        while ((match = re.exec(text)) && match.indices) {
            result.ins(i, match.indices[1][1], " ");
        }

        // Case: ,<SPACE>word
        re = /(,)\S/g;
        while ((match = re.exec(text))) {
            result.ins(i, match.index + 1, " ");
        }

        // Case: keyword<SPACE>() & function_name<NO SPACE>()
        re = /(?<!".*)(?<!_)(\w+)(\s*)\((?!.*")/dg;
        while ((match = re.exec(text)) && match.indices) {
            let repStr = "";
            if (/^((if)|(for)|(while)|(return))$/.test(match[1])) {
                repStr = " ";
            }
            result.rep(i, match.indices[2][0], match.indices[2][1], repStr);
        }

        // Case: _MainTex<SPACE>("Texture", 2D)
        re = /(^|\s)_\w+(\s*)\(/dg;
        while ((match = re.exec(text)) && match.indices) {
            let repStr = isSpaceProperties ? " " : "";
            result.rep(i, match.indices[2][0], match.indices[2][1], repStr);
        }

        if (isSpaceComment) {
            // Case: //<SPACE>comment
            re = /(?<!\/\/.*)\/\/(\s*)\S/dg;
            while ((match = re.exec(text)) && match.indices) {
                if (match[1].length === 0) {
                    result.ins(i, match.indices[1][0], " ");
                }
            }

            // Case: word<SPACE>//comment
            re = /(?<!\/\/.*)(\S)\/\/(\s*)\S/dg;
            while ((match = re.exec(text)) && match.indices) {
                result.ins(i, match.indices[1][0] + 1, " ");
            }
        }

        // Case: word<NO SPACE>;
        re = /\S(\s*);/dg;
        while ((match = re.exec(text)) && match.indices) {
            result.del(i, match.indices[1][0], match.indices[1][1]);
        }
        // Case: ;<SPACE>word
        re = /;(\S)/dg;
        while ((match = re.exec(text)) && match.indices) {
            result.ins(i, match.indices[1][0], " ");
        }

        // Remove trailing spaces
        re = /\S(\s+)$/dg;
        while ((match = re.exec(text)) && match.indices) {
            result.del(i, match.indices[1][0], match.indices[1][1]);
        }
    }

    return result;
};

const formatBackward: IFormatter = (document, config) => {
    const result: Result = new Result();

    let match;

    const isBraceNewline = config.get("brace.newline") as boolean;

    // Brace the same line
    let isDeletingLine = false;
    for (let i = document.lineCount - 1; i >= 0; i--) {
        const line = document.lineAt(i);
        const text = line.text;

        if (/disable-usf/.test(text)) {
            continue;
        }

        match = /^(\s*){/d.exec(text);
        if (match && match.indices) {
            // console.log(i, "catch {", match.indices[1]);
            result.del(i, match.indices[1][0], match.indices[1][1]);
            isDeletingLine = true;
        } else if (isDeletingLine) {
            if (line.isEmptyOrWhitespace) {
                // console.log(i, "delete empty");
                result.del(i, 0, -1);
            } else {
                if (!isBraceNewline) {
                    match = /\S(\s*)$/d.exec(text);
                    if (match && match.indices) {
                        // console.log(i, "catch non-empty", match.indices[1]);
                        result.del(i, match.indices[1][0], -1);
                    }
                }
                isDeletingLine = false;
            }
        }
    }

    return result;
};

function formatter(document: vscode.TextDocument): vscode.TextEdit[] {
    const config = vscode.workspace.getConfiguration("unity-shader.format");
    const result: Result = new Result();

    const formatters: IFormatter[] = [formatForward, formatBackward];
    for (let fmt of formatters) {
        globalFlag++;
        let res = fmt(document, config);
        result.extend(res);
    }

    result.setup();
    // console.log(result.inserts);
    // console.log(result.deletes);

    const edits: vscode.TextEdit[] = [];
    for (let i of result.inserts) {
        edits.push(
            vscode.TextEdit.insert(new vscode.Position(i.line, i.index), i.data)
        );
    }
    for (let d of result.deletes) {
        edits.push(
            vscode.TextEdit.delete(
                new vscode.Range(d.lineStart, d.start, d.lineEnd, d.end)
            )
        );
    }

    return edits;
}

export default formatter;
