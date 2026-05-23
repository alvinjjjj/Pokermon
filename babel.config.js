module.exports = function (api) {
  api.cache(true);

  const isProd = process.env.NODE_ENV === 'production';

  // Inline plugin: remove console.log / console.info / console.debug in prod
  // console.error and console.warn are kept so crash reports still work
  const removeConsolePlugin = ({ types: t }) => ({
    visitor: {
      CallExpression(path) {
        const { callee } = path.node;
        if (
          t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: 'console' }) &&
          ['log', 'info', 'debug', 'time', 'timeEnd'].includes(callee.property.name)
        ) {
          path.remove();
        }
      },
    },
  });

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(isProd ? [removeConsolePlugin] : []),
    ],
  };
};
