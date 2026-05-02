/**
 * Tree-Sitter queries for GDScript syntax extraction.
 * These queries identify structural elements like function definitions, 
 * class definitions, and call sites for the GitNexus ingestion pipeline.
 */

export const GDScriptQueries = {
  // Captures function definitions, including name and return type
  definitions: `
    (function_definition
      name: (name) @definition.function
      return_type: (type)? @return.type)
    (class_definition
      name: (name) @definition.class)
  `,

  // Captures variable/property declarations at the top level or within functions
  properties: `
    (variable_statement
      name: (name) @definition.property
      value: (expression) @property.value)
  `,

  // Captures call sites: function calls and method calls (attribute calls)
  calls: `
    (call
      function: (identifier) @call.name
      arguments: (arguments)? @call.args)
    (attribute_call
      object: (identifier) @call.receiver
      method: (identifier) @call.name
      arguments: (arguments)? @call.args)
  `,

  // Capts GDScript specific dependency markers: 'extends' and 'preload'
  dependencies: `
    (extends_statement
      base_type: (type) @dependency.extends)
    (preload_statement
      path: (string) @dependency.preload)
  `
};
