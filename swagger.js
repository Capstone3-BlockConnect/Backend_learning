const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  swaggerDefinition: {
    info: {
      title: 'MyBoard API',
      version: '1.0.0',
      description: 'APIs for MyBoard application',
    },
    basePath: '/',
  },
  apis: ['./server.js'], // API 라우터 파일의 경로를 지정합니다.
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;