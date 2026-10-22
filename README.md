# 기계설비 공정분리 자동화 툴

기계설비 계약 내역서(엑셀)를 올리면 공종 계층(대공종 › 소공종 › 세부공종)을 정리하고,
품목을 자재 카테고리(백강관, STS위생관, PB, 밸브류 …)로 자동 분류해
카테고리별 대시보드·구간집계표·단가분석·엑셀/PDF 내보내기를 제공하는 웹 프로그램입니다.

## 실행 방법

**윈도우: `시작.bat` 더블클릭** → 처음 한 번은 패키지를 자동 설치하고, 준비되면 브라우저가 자동으로 열립니다.
(맥/리눅스는 `./start.sh`)

수동으로 실행하려면:

1. Node.js 20 이상 설치
2. 압축을 푼 폴더에서
   ```
   npm install
   npm run dev
   ```
3. 브라우저에서 http://localhost:3000 접속

같은 사무실 PC에서는 `http://<이 PC의 IP>:3000` 으로도 접속됩니다.

### 배포용 빌드

```
npm run build
npm start
```

## 웹 배포 (GitHub → Vercel)

`main` 브랜치에 push 하면 Vercel 이 자동으로 빌드·배포합니다.

- 화면: Vite 정적 빌드 (`dist`)
- AI 분류: `api/classify.ts` 서버리스 함수 (로컬 `server.ts` 와 같은 `api/_lib/classify.ts` 로직 사용)
- 환경변수: Vercel 프로젝트 Settings → Environment Variables 에 `.env` 와 같은 키를 등록
  (`VITE_FIREBASE_*` 는 빌드 시 반영되므로 바꾼 뒤에는 Redeploy 필요)

## 설정 (.env)

| 항목 | 설명 |
|---|---|
| `VITE_FIREBASE_*` | 현장/규칙/카테고리를 PC 간 동기화하는 Firestore 설정. 동봉된 `.env` 에는 원본 앱이 쓰던 DB 값이 들어 있어 기존 데이터가 그대로 보입니다. |
| `GEMINI_API_KEY` | 'AI 분류' 버튼에서 규칙으로 못 잡은 품목을 Gemini 로 분류할 때 사용. 비워 두면 규칙·키워드 기반으로만 분류합니다. |
| `GEMINI_MODELS` | 시도할 Gemini 모델 목록(쉼표 구분). |
| `PORT` | 서버 포트 (기본 3000). |

`.env` 는 `.gitignore` 에 포함되어 있어 깃에 올라가지 않습니다. 새 PC에는 `.env.example` 을 복사해 값을 채우세요.

## 폴더 구조

```
server.ts                 Express 서버 (Vite 개발서버 + /api/classify AI 분류)
src/App.tsx               전체 상태·저장·동기화·화면 구성
src/components/           화면 컴포넌트 (내역 테이블, 구간집계표, 카테고리 관리 등)
src/utils/classifier.ts   규칙 기반 자동 분류
src/utils/sectionHierarchy.ts  공종 코드(6/8/10자리) 계층 정리
src/utils/costCalculation.ts   재료비/노무비/외주비/간접비 집계 (방식1·방식2)
src/utils/excelExport.ts  서식 포함 엑셀 내보내기
src/lib/firebase.ts       Firestore 저장/구독
firestore.rules           Firestore 보안 규칙 (현재 전체 공개 — README 하단 참고)
```

## 주의

- `firestore.rules` 가 `allow read, write: if true` (누구나 읽기/쓰기/삭제 가능) 상태입니다.
  프로젝트 ID만 알면 외부에서 접근할 수 있으니 실사용 전에 인증을 붙이는 것을 권장합니다.
- '내역분리 완료' 잠금 해제 비밀번호는 `src/App.tsx` 의 `handleVerifyPassword` 에 있습니다 (기존과 동일: 4714).

## 원본(AI Studio) 대비 변경 사항

화면·기능은 원본과 동일하고, 아래만 바뀌었습니다.

**이식 작업**
- Firebase 설정을 `firebase-applet-config.json` → `.env` 로 이동 (Firebase 값이 비어 있으면 로컬 저장 모드로 동작)
- Gemini 키·모델·포트를 `.env` 로 이동, AI Studio 전용 파일(.aistudio, metadata.json, bun.lock 등) 제거
- 페이지 제목 한글화, 할당량 안내창의 Firebase 콘솔 링크를 `.env` 값으로 생성

**버그 수정**
- 현장 기본정보(착공일·준공일·동수·세대수·최고/최저층)와 집계 방식이 클라우드/자동저장에 저장되지 않아 다시 열면 사라지던 문제
- '새 현장' 시작 시 이전 현장의 기본정보·수기 금액이 새 현장에 그대로 따라가던 문제
- '내역분리 완료' 시 집계 방식이 바뀌기 전 값으로 저장되던 문제
- 선택 품목 'AI 재분류' / '해당 품목만 AI 분류 실행' 이 실제로는 전체 품목을 다시 분류해 수동 분류를 덮어쓰던 문제
- AI 분류 실패(또는 키 없음) 시 분류 못 한 품목이 카테고리 목록 첫 번째(백강관)로 들어가던 문제 → '미분류' 로 남김
- 같은 엑셀 파일을 다시 선택하면 업로드가 안 되던 문제, 업로드 영역 드래그&드롭이 안 되던 문제
