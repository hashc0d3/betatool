import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  it('GET /products without auth returns 401', () => {
    return request(app.getHttpServer()).get('/products').expect(401);
  });

  it('GET /products after login returns 200', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ login: 'playbetaadmin', password: 'playbetaadmin2026!' })
      .expect(200);
    await agent.get('/products').expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});
