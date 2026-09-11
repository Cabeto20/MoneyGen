/**
 * O Metro resolve imports sem extensão ('./dateHelpers') e imports de pasta
 * ('./entities' → './entities/index.js'); o loader ESM do Node exige o caminho
 * completo. Este hook cobre os dois casos para o motor do assistente rodar em
 * Node puro, sem que o código-fonte carregue uma convenção que só existiria
 * por causa do script de verificação.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') || specifier.endsWith('.js')) throw error;

    try {
      return await nextResolve(`${specifier}.js`, context);
    } catch {
      return nextResolve(`${specifier}/index.js`, context);
    }
  }
}
