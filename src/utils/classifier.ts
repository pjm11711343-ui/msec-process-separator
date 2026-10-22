
import { SpecItem, CustomClassificationRule } from '../types';

const MAPPING_RULES: Record<string, string> = {
  '고강도 PVC관': '고강도PVC',
  '고강도PVC이음관': '고강도PVC',
  'DH관': '고강도PVC',
  'VG1': 'PVC',
  'VG2': 'PVC',
  '폴리부틸렌관': 'PB',
  '합성수지제가요전선관': 'PB',
  '소음방지링': 'PB',
  '실링캡': 'PB',
  '관말캡': 'PB',
  '합성수지제가요전선관(냉장고용)': 'PB',
  'MP박스': 'PB',
  '냉장고용 공박스': 'PB',
  '원형수전브라켓': 'PB',
  '일반용경질염화비닐관': 'PVC',
  '배수용경질염화비닐이음관': 'PVC',
  'DRF-X': 'PVC',
  'VENT 캡': 'PVC',
  'PVC스리브': 'PVC',
  '소재구': 'PVC',
  '배관용스테인리스강관': 'STS위생관',
  '일반배관용스테인리스강관': 'STS위생관',
  'STS 위생관': 'STS위생관',
  '급수용스테인리스': 'STS위생관',
  '급탕용스테인리스': 'STS위생관',
  '일반배관용STS강관이음쇠': 'STS위생부속',
  'STS 위생부속': 'STS위생부속',
  '스텐용접합후렌지': 'STS위생부속',
  '무용접스텐엘보': 'STS위생부속',
  '무용접스텐티이': 'STS위생부속',
  '무용접스텐리듀서': 'STS위생부속',
  '무용접스텐캡': 'STS위생부속',
  '무용접스텐플랜지아답타': 'STS위생부속',
  '일반행거': 'SUPPORT류',
  '절연행가': 'SUPPORT류',
  'U자형볼트': 'SUPPORT류',
  '인서트플레이트': 'SUPPORT류',
  '달대볼트': 'SUPPORT류',
  '행거': 'SUPPORT류',
  '가대': 'SUPPORT류',
  '찬넬': 'SUPPORT류',
  '감압밸브': '감압변',
  '세대별물감압밸브': '감압변',
  '압력계설치': '밸브류',
  '플랜지': '강관부속',
  '용접식관이음쇠': '강관부속',
  '무용접엘보': '강관부속',
  '무용접티이': '강관부속',
  '무용접플랜지아답타니플': '강관부속',
  '무용접고정식커플링': '강관부속',
  '강관용접': '강관부속',
  '용접합후렌지': '강관부속',
  '일체형 고정 틀': '입상고정틀+내화충진재',
  '온수분배기': '난방분배기',
  '온도조절밸브': '난방분배기',
  '구동기': '난방분배기',
  '씽크수전지지대': '난방분배기',
  '유니온엘보': '난방분배기',
  '코일고정U핀': '난방코일',
  'FLOORPANEL': '난방코일',
  '내화충진재': '입상고정틀+내화충진재',
  '에어컨 냉매배관': '냉매배관',
  '에어컨 냉매박스': '냉매배관',
  '테스트용질소': '냉매배관',
  '제습기': '마감자재',
  '방열기': '마감자재',
  '온수기': '마감자재',
  '보일러하부배관고정크램프': '마감자재',
  '터파기': '기타자재',
  '되메우기': '기타자재',
  '모래부설': '기타자재',
  'IDNTIFICATION&TAGGING': '명판',
  '배관인식표': '명판',
  '게이트 밸브': '밸브류',
  '목긴볼밸브': '밸브류',
  '버터플라이밸브': '밸브류',
  '체크밸브': '밸브류',
  '스트레이너': '밸브류',
  '플랙시블조인트': '밸브류',
  '수격방지기': '밸브류',
  '정수위 조절 밸브': '밸브류',
  '플로우트밸브': '밸브류',
  '피스텍밸브': '밸브류',
  '볼밸브': '밸브류',
  '청소용수채': '밸브류',
  '알람밸브': '밸브류',
  '프리액션밸브': '밸브류',
  '드라이밸브': '밸브류',
  '관보온': '보온재',
  '밸브보온': '보온재',
  '아티론보온': '보온재',
  '폼보온': '보온재',
  '고무발포': '보온재',
  '매직테이프': '보온재',
  '잡재료비': '소모잡자재',
  '유성페인트': '소모잡자재',
  '녹막이페인트칠': '소모잡자재',
  '부동급수전': '밸브류',
  '잡철물제작설치': '소모잡자재',
  '소모품': '소모잡자재',
  '디지털수도미터': '수도계량기',
  '디지털온수미터': '수도계량기',
  '수도계량기': '수도계량기',
  '방수스리브': '스리브',
  '강관스리브': '스리브',
  'F.D': '스리브',
  '벽체점검용스리브': '스리브',
  '삼중루프드레인': '스리브',
  '드레인': '스리브',
  '동파방지전열선': '열선',
  '초절전온수관': '열선',
  '점검구박스': '열선',
  '온도조절기': '열선',
  '펌프가대설치': '조립식가대',
  '기계실작업발판': '조립식가대',
  '기계실 잡철물': '조립식가대',
  'ㄱ형강': '조립식가대',
  '시스템찬넬': '조립식가대',
  '3구 분기관': '통합거치대',
  '수압용압력계': '통합거치대',
  '수도용앵글밸브': '통합거치대',
  '세대역류방지밸브': '통합거치대',
  '수도계량기 보호함': '통합거치대',
  '링죠인트': '통합거치대',
  '목긴볼밸브(보온용)': '통합거치대',
  '스프링클러': '소방부속',
  'SP헤드': '소방부속',
  '소방용CPVC': 'CPVC 소방관',
  'CPVC이음관': 'CPVC 소방부속',
  '템퍼스위치': '소방부속',
  '양변기': '지금자재',
  '소변기': '지금자재',
  '세면기': '지금자재',
  '샤워수전': '지금자재',
  '트랩': 'PVC',
  '공구손료': '공구손료'
};

export function autoClassify(
  item: SpecItem, 
  customRules?: CustomClassificationRule[]
): { category: string; remark: string } {
  if (!item) return { category: '미분류', remark: '데이터 없음' };
  
  // Rule: If material price is 0 but labor price/amount is greater than 0, classify as "미분류"
  if ((!item.materialUnitPrice || item.materialUnitPrice === 0) && (item.laborUnitPrice > 0 || item.laborAmount > 0)) {
    return { category: '미분류', remark: '노무비 단독 항목 (공정분리 미분류)' };
  }

  const name = (item.name || '').replace(/\s+/g, '');
  const spec = (item.specification || '').replace(/\s+/g, '');
  let category = item.category || '';

  // Targeted normalization for STS hygiene categories (removing internal spaces)
  const cleanCat = category.replace(/\s+/g, '');
  if (cleanCat === 'STS위생관') category = 'STS위생관';
  if (cleanCat === 'STS위생부속') category = 'STS위생부속';

  // Rule: If both material and labor prices are 0, classify as "지금자재"
  if (item.materialUnitPrice === 0 && item.laborUnitPrice === 0) {
    return { category: '지금자재', remark: '지금자재' };
  }

  // 1. Apply user custom rules first
  if (customRules && customRules.length > 0) {
    const sortedRules = [...customRules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const rule of sortedRules) {
      if (!rule.isEnabled) continue;
      const cleanPattern = rule.pattern.replace(/\s+/g, '').toLowerCase();
      const cleanName = item.name.replace(/\s+/g, '').toLowerCase();
      const cleanSpec = (item.specification || '').replace(/\s+/g, '').toLowerCase();
      
      if (cleanName.includes(cleanPattern) || cleanSpec.includes(cleanPattern)) {
        return { 
          category: rule.category, 
          remark: `사용자 정의 규칙 (${rule.pattern}, 우선순위: ${rule.priority ?? 0})` 
        };
      }
    }
  }
  
  for (const [key, cat] of Object.entries(MAPPING_RULES)) {
    const cleanKey = key.replace(/\s+/g, '');
    if (name.includes(cleanKey)) {
      category = cat;
      break;
    }
  }

  // Section Specific Overrides
  const section = item.section || '';

  // Core User rule: 공정에 0101로시작하는 번호가 없거나 옥내공사용수배관설치비, 가설소화호스함, 지수층 배관설치비, 주차장 우수유도 배관설치비, 지하 환기덕트공사비들은 가설공사 분류해줘
  const normNameForTemp = name.replace(/\s+/g, '');
  const normSpecForTemp = spec.replace(/\s+/g, '');
  
  const has0101InDigits = section ? section.split(/[^0-9]/).some(part => part.startsWith('0101')) : true;
  
  const isTemporaryWorkName = normNameForTemp.includes('옥내공사용수배관설치비') ||
                              normNameForTemp.includes('가설소화호스함') ||
                              normNameForTemp.includes('지수층배관설치비') ||
                              normNameForTemp.includes('주차장우수유도배관설치비') ||
                              normNameForTemp.includes('지하환기덕트공사비') ||
                              normSpecForTemp.includes('옥내공사용수배관설치비') ||
                              normSpecForTemp.includes('가설소화호스함') ||
                              normSpecForTemp.includes('지수층배관설치비') ||
                              normSpecForTemp.includes('주차장우수유도배관설치비') ||
                              normSpecForTemp.includes('지하환기덕트공사비');

  if ((section && !has0101InDigits) || isTemporaryWorkName) {
    return { category: '가설공사', remark: '가설공사' };
  }

  // Core User rule: 펌프가대설치(배수펌프) 또는 펌프가대설치는 조립식가대로 분류해줘
  if (name.includes('펌프가대설치')) {
    return { category: '조립식가대', remark: '조립식가대' };
  }

  // Core User rule: 공정 01010406으로 시작하는 공정들에서 아티론보온은 외주로 분류해줘
  if (section.includes('01010406')) {
    const normName = name.replace(/\s+/g, '');
    const normSpec = spec.replace(/\s+/g, '');
    if (normName.includes('아티론보온') || normSpec.includes('아티론보온')) {
      return { category: '외주', remark: '외주' };
    }
  }

  // Core User rule: 공정에 01010804 관보온은 외주로 분류해줘
  if (section.includes('01010804')) {
    const normName = name.replace(/\s+/g, '');
    const normSpec = spec.replace(/\s+/g, '');
    if (normName.includes('관보온') || normSpec.includes('관보온')) {
      return { category: '외주', remark: '외주' };
    }
  }

  // Core User rule: 공정 01010604에 F.D(STL)은 외주로 분류해줘
  if (section.includes('01010604')) {
    const normName = name.toLowerCase();
    const normSpec = spec.toLowerCase();
    
    if (
      normName.includes('f.d(stl)') || 
      normName.includes('fd(stl)') || 
      (normName.includes('f.d') && normName.includes('stl')) ||
      (normName.includes('fd') && normName.includes('stl')) ||
      normName === 'f.d' ||
      normName === 'fd' ||
      normSpec.includes('f.d(stl)') ||
      normSpec.includes('fd(stl)')
    ) {
      return { category: '외주', remark: '외주' };
    }
  }

  // Core User rule: PART 010104010, 01010401, 01010801공정에 품명:폴리푸틸렌관 규격:PB,난방용, D15는 난방코일로 분류, D20은 PB로 분류, 위생용은 PB로 분류
  if (section.includes('01010401') || section.includes('01010801') || section.includes('010104010')) {
    const normName = name.toLowerCase();
    const normSpec = spec.toLowerCase();
    
    const hasPB = normName.includes('폴리부틸렌') || normName.includes('폴리푸틸렌') || normName.includes('pb') ||
                  normSpec.includes('폴리부틸렌') || normSpec.includes('폴리푸틸렌') || normSpec.includes('pb');
                  
    if (hasPB) {
      const hasD20 = normName.includes('20') || normSpec.includes('20') || normSpec.includes('d20');
      const hasD15 = normName.includes('15') || normSpec.includes('15') || normSpec.includes('d15');
      
      if (hasD20) {
        return { category: 'PB', remark: 'PB' };
      } else if (hasD15) {
        const isHeating = normName.includes('난방') || normSpec.includes('난방');
        const isSanitary = normName.includes('위생') || normSpec.includes('위생') || normName.includes('급수') || normSpec.includes('급수') || normName.includes('급탕') || normSpec.includes('급탕');
        
        if (isHeating) {
          return { category: '난방코일', remark: '난방코일' };
        } else if (isSanitary) {
          return { category: 'PB', remark: 'PB' };
        } else {
          if (section.includes('난방')) {
            return { category: '난방코일', remark: '난방코일' };
          }
          return { category: 'PB', remark: 'PB' };
        }
      }
    }
  }

  // User rule for 01010403 starting sections
  if (section.includes('01010403')) {
    const normName = name.toLowerCase();
    const normSpec = spec.toLowerCase();
    
    const hasPB = normName.includes('폴리부틸렌') || normName.includes('폴리푸틸렌') || normName.includes('pb') ||
                  normSpec.includes('폴리부틸렌') || normSpec.includes('폴리푸틸렌') || normSpec.includes('pb');
                  
    if (hasPB) {
      const normSpecNoSec = normSpec.replace(/\s+/g, '');
      const isIntegratedStand = (normSpecNoSec.includes('pb수전엘보') && (normSpecNoSec.includes('15') || normSpecNoSec.includes('d15'))) ||
                               (normSpecNoSec.includes('pb티이') && (normSpecNoSec.includes('15') || normSpecNoSec.includes('d15')));
      
      if (isIntegratedStand) {
        return { category: '통합거치대', remark: '통합거치대' };
      }

      const hasD15 = normName.includes('15') || normSpec.includes('15') || normSpec.includes('d15');
      const isSanitary = normName.includes('위생') || normSpec.includes('위생') || 
                         normName.includes('급수') || normSpec.includes('급수') || 
                         normName.includes('급탕') || normSpec.includes('급탕');
                         
      if (hasD15 || isSanitary) {
        return { category: 'PB', remark: 'PB' };
      }
    }
  }

  // 1. 난방공사 (Heating)
  if (section.includes('난방') || name.includes('난방')) {
    if (category.startsWith('STS') || name.includes('스텐') || name.includes('스테인리스') || name.includes('STS')) {
      if (name.includes('관') || name.includes('파이프')) {
        category = 'STS난방관';
      } else {
        category = 'STS난방부속';
      }
    } else if (
      name.includes('분배기') || 
      name.includes('온도조절밸브') || 
      name.includes('구동기') ||
      name.includes('D15EA')
    ) {
      category = '난방분배기';
    } else if (
      ((name.includes('폴리부틸렌') || name.includes('PB')) && (name.includes('난방') || name.includes('코일'))) ||
      (name.includes('난방') && name.includes('용'))
    ) {
      category = '난방코일';
    }
  }

  // 2. 위생배관공사 (Sanitary/Hygiene)
  if (section.includes('위생') || section.includes('급수') || section.includes('급탕') || name.includes('위생')) {
    if (category.startsWith('STS') || name.includes('스텐') || name.includes('스테인리스') || name.includes('STS')) {
      if (name.includes('관') || name.includes('파이프')) {
        category = 'STS위생관';
      } else {
        category = 'STS위생부속';
      }
    }
  }

  // 5. 기계실환기덕트 (Mechanical Room Ventilation) - Classified as Outsourcing
  if (section.includes('기계실환기덕트')) {
    const outsourcingKeywords = [
      '각형덕트', '캔버스', '점검구', '동망', '유성페인트', '녹막이페인트',
      'B.D.D', 'GRILLE', 'F.D', 'REGISTER', '노무비'
    ];
    if (outsourcingKeywords.some(k => name.toUpperCase().includes(k.toUpperCase()))) {
      category = '외주';
    }
  }

  // 4. 단위세대 (Unit Generation) - Special override for integrated brackets
  if (section.includes('단위세대')) {
    const s = spec.toLowerCase();
    const n = name.toLowerCase();
    const sec = section.toLowerCase();

    if (sec.includes('01010407') && n.includes('커플링') && (s.includes('204x60') || s.includes('204*60'))) {
      category = '외주';
      return { category, remark: category };
    }

    // 난방배관공사 단위세대 특이사항
    if (sec.includes('난방배관공사') || sec.includes('01010401') || sec.includes('01010405') || sec.includes('세대내배관공사')) {
      if (n.includes('폴리부틸렌관')) {
        category = 'PB';
        return { category, remark: category };
      }
      if (n.includes('목긴볼밸브')) {
        category = '밸브류';
        return { category, remark: category };
      }
    }

    if (sec.includes('난방배관공사')) {
      if (n.includes('폴리부틸렌관') && (s.includes('pb엘보d20') || s.includes('pbf밸브소켓d20') || s.includes('pbm밸브소켓d20'))) {
        category = 'PB';
        return { category, remark: category };
      }
      if (n.includes('목긴볼밸브') && s.includes('황동,10kg,d20')) {
        category = '밸브류';
        return { category, remark: category };
      }
    }

    if (n.includes('폴리부틸렌관') && s.includes('pb관') && (s.includes('난방용') || s.includes('위생용')) && s.includes('d15')) {
      category = '난방코일';
    } else if (n.includes('폴리부틸렌관') && (s.includes('pb관') && (s.includes('난방용') || s.includes('위생용')) && s.includes('d20') || s.includes('pb서포트스리브'))) {
      category = 'PB';
    } else if (
      n.includes('sts강관이음쇠') || 
      n.includes('폴리부틸렌관') || 
      n.includes('폴리부틸렌') || 
      n.includes('pb') || 
      n.includes('목긴볼밸브') || 
      n.includes('수도용앵글밸브') || 
      n.includes('세대역류방지') || 
      n.includes('통합거치대') ||
      n.includes('분기관') ||
      n.includes('압력계') ||
      n.includes('수도계량기') ||
      n.includes('링죠인트') ||
      n.includes('리듀서') ||
      s.includes('pb엘보') ||
      s.includes('pb티이') ||
      s.includes('pb수전엘보') ||
      s.includes('pbf밸브소켓') ||
      s.includes('pbm밸브소켓') ||
      n.includes('세대일체형브라켓')
    ) {
      category = '통합거치대';
    }
  }

  // 3. 소방공사 (Fire Protection)
  if (section.includes('소방') || name.includes('소방') || name.includes('스프링클러')) {
    if (name.includes('CPVC')) {
      if (name.includes('관') || name.includes('파이프')) {
        category = 'CPVC 소방관';
      } else {
        category = 'CPVC 소방부속';
      }
    } else if (name.includes('강관') || name.includes('흑관') || name.includes('백관')) {
       if (name.includes('관') || name.includes('파이프')) {
        category = '강관 소방관';
      } else {
        category = '강관 소방부속';
      }
    } else if (name.includes('헤드') || name.includes('조인트') || name.includes('그루브') || name.includes('커플링')) {
      category = '소방부속';
    }
  }

  // Final overrides for specific requested strings
  if (name.includes('스텐관용접')) {
    if (section.includes('난방')) {
      category = 'STS난방부속';
    } else {
      category = 'STS위생부속';
    }
  }

  if (name.includes('온도조절밸브비례제어형') || name.includes('구동기비례제어형')) {
    category = '난방분배기';
  }
  if (name.includes('강관스리브') || name.includes('PVC스리브') || name.toLowerCase().includes('pvc스리브(벽체)') || name.includes('볼텍스') || name.includes('이중배관소켓')) {
    category = '스리브';
  }
  if (spec.includes('스리브') && !spec.includes('PB서포트스리브')) {
    category = '스리브';
  }
  if ((name.includes('폴리부틸렌관') || spec.includes('PB서포트스리브')) && !section.includes('단위세대')) {
    category = 'PB';
  }
  if (name.includes('멀티캡')) {
    category = '마감자재';
  }
  if (name.includes('시스템가대브라켓') || name.includes('조립식찬넬설치공사') || name.includes('시스템찬넬') || name.includes('펌프가대설치')) {
    category = '조립식가대';
  }
  if (section.includes('조립식찬넬설치공사') && name.includes('그외부속류')) {
    category = '조립식가대';
  }
  if (name.includes('공구손료')) {
    const outsourcingSections = [
      '부대시설전열교환기공사',
      '부대시설환기덕트설치공사',
      '근생환기덕트설치공사',
      '전열교환기 설치공사',
      '기계실환기덕트설치공사',
      '주차장환기덕트설치공사'
    ];
    if (outsourcingSections.some(sec => section.includes(sec))) {
      category = '외주';
    } else {
      category = '공구손료';
    }
  }

  if (name.includes('난연이중크린호스Y분기관')) {
    category = '외주';
  }
  if (name.includes('일반배관용STS강관이음쇠')) {
    if (section.includes('01010403')) {
      category = '통합거치대';
    } else {
      category = 'STS위생부속';
    }
  }
  if (name.toLowerCase().includes('플랜지(flange)') && spec.toLowerCase().includes('pvcts플랜지')) {
    category = 'PVC';
  }
  if (section.includes('주차장환기덕트설치공사')) {
    if (name.includes('유성페인트') || name.includes('녹막이페인트')) {
      category = '외주';
    }
  }

  // User requested rules
  if (section.includes('01010401') || section.includes('01010801') || section.includes('010104010')) {
    const normName = name.replace(/\s+/g, '').toLowerCase();
    const normSpec = spec.replace(/\s+/g, '').toLowerCase();
    
    const hasPB = normName.includes('폴리부틸렌') || normName.includes('폴리푸틸렌') || normName.includes('pb') ||
                  normSpec.includes('폴리부틸렌') || normSpec.includes('폴리푸틸렌') || normSpec.includes('pb');
                  
    if (hasPB) {
      const hasD20 = normName.includes('20') || normSpec.includes('20') || normSpec.includes('d20');
      const hasD15 = normName.includes('15') || normSpec.includes('15') || normSpec.includes('d15');
      
      if (hasD20) {
        category = 'PB';
      } else if (hasD15) {
        const isHeating = normName.includes('난방') || normSpec.includes('난방');
        const isSanitary = normName.includes('위생') || normSpec.includes('위생') || normName.includes('급수') || normSpec.includes('급수') || normName.includes('급탕') || normSpec.includes('급탕');
        
        if (isHeating) {
          category = '난방코일';
        } else if (isSanitary) {
          category = 'PB';
        } else {
          if (section.includes('난방')) {
            category = '난방코일';
          } else {
            category = 'PB';
          }
        }
      }
    }
  }

  // User rule for 01010403 starting sections
  if (section.includes('01010403')) {
    const normName = name.replace(/\s+/g, '').toLowerCase();
    const normSpec = spec.replace(/\s+/g, '').toLowerCase();
    
    const hasPB = normName.includes('폴리부틸렌') || normName.includes('폴리푸틸렌') || normName.includes('pb') ||
                  normSpec.includes('폴리부틸렌') || normSpec.includes('폴리푸틸렌') || normSpec.includes('pb');
                  
    if (hasPB) {
      const normSpecNoSec = normSpec.replace(/\s+/g, '');
      const isIntegratedStand = (normSpecNoSec.includes('pb수전엘보') && (normSpecNoSec.includes('15') || normSpecNoSec.includes('d15'))) ||
                               (normSpecNoSec.includes('pb티이') && (normSpecNoSec.includes('15') || normSpecNoSec.includes('d15')));

      if (isIntegratedStand) {
        category = '통합거치대';
      } else {
        const hasD15 = normName.includes('15') || normSpec.includes('15') || normSpec.includes('d15');
        const isSanitary = normName.includes('위생') || normSpec.includes('위생') || 
                           normName.includes('급수') || normSpec.includes('급수') || 
                           normName.includes('급탕') || normSpec.includes('급탕');
                           
        if (hasD15 || isSanitary) {
          category = 'PB';
        }
      }
    }
  }

  // User rule for 01010406 starting sections
  if (section.includes('01010406')) {
    const normName = name.replace(/\s+/g, '');
    const normSpec = spec.replace(/\s+/g, '');
    if (normName.includes('아티론보온') || normSpec.includes('아티론보온')) {
      category = '외주';
    }
  }

  // User rule for 01010804 starting sections
  if (section.includes('01010804')) {
    const normName = name.replace(/\s+/g, '');
    const normSpec = spec.replace(/\s+/g, '');
    if (normName.includes('관보온') || normSpec.includes('관보온')) {
      category = '외주';
    }
  }

  // User rule for 01010604 starting sections
  if (section.includes('01010604')) {
    const normName = name.replace(/\s+/g, '').toLowerCase();
    const normSpec = spec.replace(/\s+/g, '').toLowerCase();
    
    if (
      normName.includes('f.d(stl)') || 
      normName.includes('fd(stl)') || 
      (normName.includes('f.d') && normName.includes('stl')) ||
      (normName.includes('fd') && normName.includes('stl')) ||
      normName === 'f.d' ||
      normName === 'fd' ||
      normSpec.includes('f.d(stl)') ||
      normSpec.includes('fd(stl)')
    ) {
      category = '외주';
    }
  }

  if (name.includes('압력계설치(STS)')) {
    category = '밸브류';
  }
  if (name.includes('일체형고정틀(STS)/K-TYPE')) {
    category = '입상고정틀+내화충진재';
  }
  if (name.includes('안전발판사다리')) {
    category = '마감자재';
  }
  if (name.includes('PVC역류방지밸브')) {
    category = 'PVC';
  }
  if (name.includes('PD내비상배수시스템')) {
    category = '스리브';
  }
  if (name.includes('배수용주철이형관')) {
    category = '스리브';
  }
  if (name.includes('조경수전함')) {
    category = '밸브류';
  }

  // User requested: 자재비에 노무비 있는 금액은 노무비만 추출해서 간접비로 추가
  const isLaborKeyword = name.includes('노무비') || name.includes('인건비') || name.includes('가공비') || 
                        spec.includes('노무비') || spec.includes('인건비') || spec.includes('가공비') ||
                        name === '품' || spec === '품' || name.includes('공수');

  if (isLaborKeyword) {
    category = '간접비';
  }

  if (section.replace(/\s+/g, '').includes('세대외오배수배관공사')) {
    if (name.includes('동만') || name.includes('동망') || name.includes('동관') || name.includes('동')) {
      category = 'PVC';
    }
  }

  // Final override for 가설공사
  if ((section && !has0101InDigits) || isTemporaryWorkName) {
    category = '가설공사';
  }

  return { 
    category, 
    remark: category 
  };
}
