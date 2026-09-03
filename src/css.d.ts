// Next.js solo declara tipos para *.module.css (CSS Modules) en sus
// propios .d.ts. Los imports planos como `import './globals.css'`
// (sin export de clases) no tienen una declaración ambiental por
// defecto, lo que genera el warning ts(2882) en el editor.
// Esto es solo para el IDE — Next.js maneja el import real vía webpack
// en build/runtime, así que esto NO afecta el funcionamiento del sitio.
declare module '*.css';
