import nextConfig from 'eslint-config-next';
import baseConfig from './base.mjs';

// O bloco base vem por último: no flat config, o último bloco substitui as opções da mesma regra.
const webConfig = [...nextConfig, ...baseConfig];

export default webConfig;
