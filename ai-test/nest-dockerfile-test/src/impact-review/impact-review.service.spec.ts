import { ImpactReviewService } from './impact-review.service';

describe('ImpactReviewService', () => {
  it('detects high-risk areas from changed files', () => {
    const service = new ImpactReviewService();
    const impact = (service as any).analyzeImpact([
      { status: 'M', path: 'src/auth/role.controller.ts', additions: 4, deletions: 1 },
      { status: 'M', path: 'db/migration.sql', additions: 3, deletions: 2 },
    ], '');
    expect(impact.map((item: any) => item.name)).toEqual(expect.arrayContaining(['认证与权限', '接口兼容性', '数据与迁移']));
    expect(impact.find((item: any) => item.name === '认证与权限')).toMatchObject({
      affected: expect.stringContaining('登录'),
      recommendedChecks: expect.arrayContaining(['未登录访问']),
    });
  });

  it('forces security testing for critical impact', () => {
    const service = new ImpactReviewService();
    const plan = (service as any).buildTestPlan({ request: {}, impactAreas: [{ risk: 'critical' }] });
    expect(plan.find((item: any) => item.type === 'security').selected).toBe(true);
  });
});
