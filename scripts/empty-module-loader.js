// Loader que reemplaza el contenido del módulo por uno vacío.
module.exports = function emptyModuleLoader() {
  return '/* polyfill-module removido: el sitio apunta solo a navegadores modernos */\nexport {};\n';
};