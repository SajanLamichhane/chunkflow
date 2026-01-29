import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health/health.controller";

describe("HealthController", () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe("health check", () => {
    it("should return health status", () => {
      const result = healthController.check();
      expect(result).toHaveProperty("status", "ok");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("uptime");
    });
  });
});
