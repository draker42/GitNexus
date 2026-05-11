import { Resolver } from '../../resolver';
import { findProjectRoot } from '../../../utils/project-utils';

class GDScriptResolver extends Resolver {
  // Resolve preload and load calls
  resolveImports(file: string, content: string) {
    const imports = [];
    const parser = new Parser();
    const tree = parser.parse(content);
    const query = `
      (preload
        (identifier) @import_name
      )
      (
        load
        (string_literal) @import_path
      )
    `;
    const matches = tree.rootNode.querySelectorAll(query);

    for (const match of matches) {
      if (match.type === 'preload') {
        const importName = match.childNamed('identifier').text;
        imports.push({ name: importName, type: 'preload' });
      } else if (match.type === 'load') {
        const importPath = match.childNamed('string_literal').text;
        imports.push({ name: importPath, type: 'load' });
      }
    }

    // Resolve import paths to file paths
    for (const importItem of imports) {
      if (importItem.type === 'preload') {
        // Handle preload import
        const filePath = findProjectRoot(this.ctx) + '/' + importItem.name + '.gd';
        this.imports.push({ name: importItem.name, filePath });
      } else if (importItem.type === 'load') {
        // Handle load import
        const filePath = findProjectRoot(this.ctx) + '/' + importItem.name;
        this.imports.push({ name: importItem.name, filePath });
      }
    }

    return this.imports;
  }
}
