import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../src/", import.meta.url));
async function sources(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? sources(path.join(directory, entry.name)) :
        entry.name.endsWith(".ts") ? [path.join(directory, entry.name)] : []))).flat();
}
function literal(node, env) {
    if (!node) return;
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression, env);
    if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
    if (ts.isIdentifier(node)) return env.get(node.text);
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -literal(node.operand, env);
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(element => literal(element, env));
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = literal(node.left, env), right = literal(node.right, env);
        if (left !== undefined && right !== undefined) return left + right;
    }
}

/** Resolve actual declarations, including the round, statistics and weapon loops. */
export async function serverCvarInventory() {
    const inventory = new Map();
    for (const file of await sources(root)) {
        if (/sv_convar\.ts$/.test(file)) continue;
        const text = await readFile(file, "utf8"), source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
        const visit = (node, env = new Map()) => {
            if (ts.isForOfStatement(node)) {
                const iterable = literal(node.expression, env);
                if (Array.isArray(iterable) && ts.isVariableDeclarationList(node.initializer)) {
                    const binding = node.initializer.declarations[0]?.name;
                    if (binding) for (const value of iterable) {
                        const nested = new Map(env);
                        if (ts.isIdentifier(binding)) nested.set(binding.text, value);
                        else if (ts.isArrayBindingPattern(binding)) binding.elements.forEach((element, index) => {
                            if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) nested.set(element.name.text, Array.isArray(value) ? value[index] : undefined);
                        });
                        visit(node.statement, nested);
                    }
                    return;
                }
            }
            if (ts.isCallExpression(node)) {
                const expression = node.expression;
                const direct = ts.isIdentifier(expression) && expression.text === "CreateConVar";
                const managed = ts.isPropertyAccessExpression(expression) && expression.name.text === "CreateConVar" && expression.expression.getText(source) === "ConvarManager";
                if (direct || managed) {
                    const name = literal(node.arguments[0], env), value = literal(node.arguments[1], env);
                    if (typeof name !== "string") throw new Error(`Unresolved cvar declaration in ${file}.`);
                    if (typeof name === "string") {
                        if (value === undefined) throw new Error(`Unresolved default for ${name}.`);
                        inventory.set(name, { Name: name, Default: String(value), Managed: managed,
                            Description: literal(node.arguments[3], env) ?? "", Source: path.relative(fileURLToPath(new URL("../../", import.meta.url)), file) });
                    }
                }
            }
            ts.forEachChild(node, child => visit(child, env));
        };
        visit(source);
    }
    return [...inventory.values()].sort((a, b) => a.Name.localeCompare(b.Name));
}
