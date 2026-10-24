import { describe, it, expect } from 'vitest';
import { netSalary, appraisalRating, HR_LEAVE_TYPES, APPRAISAL_AREAS } from '@/lib/hr';
describe('HR rules',()=>{
 it('tracks all seven requested HR leave types',()=>{expect(HR_LEAVE_TYPES).toEqual(['Annual','Sick','Compassionate','Study','Maternity','Paternity','Emergency']);});
 it('calculates net salary from salary, allowances, overtime and deductions',()=>{expect(netSalary({basic_salary:'500',allowances:'75',overtime:'25',deductions:'60'})).toBe(540);});
 it.each([[1,'Poor'],[2,'Fair'],[3,'Good'],[4,'Very Good'],[5,'Excellent']])('rates seven evaluation areas at %s as %s',(score,label)=>{expect(appraisalRating(Object.fromEntries(APPRAISAL_AREAS.map(k=>[k,String(score)])))).toBe(label);});
 it('rejects appraisal scores outside the five-point scale',()=>{expect(appraisalRating(Object.fromEntries(APPRAISAL_AREAS.map(k=>[k,'6'])))).toBeNull();});
});