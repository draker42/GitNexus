const Parser = require('tree-sitter');
const GDScript = require('tree-sitter-gdscript');
const fs = require('fs');

// 1. Setup Parser
const parser = new Parser();
parser.setLanguage(GDScript);

// 2. The GDScript snippet to probe
// Add any problematic code here (e.g., assignments, calls, etc.)
const code = `
var x = 10
obj.property = 20
func _ready():
    print("hello")
`;

const tree = parser.parse(code);

/**
 * Recursively traverses the tree and logs node details
 * @param {import('tree-sitter').Node} node 
 * @param {number} depth 
 */
function traverse(node, depth = 0) {
    const indent = '  '.repeat(depth);
    
    // Get field names for this node
    const fields = [];
    for (const fieldName of node.fields) {
        // We check if the field exists and what its type is
        fields.push(fieldName);
    }

    const fieldString = fields.length > 0 ? ` [fields: ${fields.join(', ')}]` : '';
    
    console.log(`${indent}Type: ${node.type}${fieldString}`);

    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
        traverse(node.child(i), depth + 1);
    }
}

console.log("--- GDScript Tree Structure Analysis ---");
console.log(`Code being analyzed:\n${code}\n`);
traverse(tree.rootNode);
console.log("\n--- End of Analysis ---");
