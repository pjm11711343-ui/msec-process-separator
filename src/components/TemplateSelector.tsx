import React from 'react';
import { SpecItem, ThemeType } from '../types';
import { Layout, Palette, Briefcase, FileText, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  onSelect: (theme: ThemeType) => void;
}

export default function TemplateSelector({ onSelect }: Props) {
  const templates = [
    {
      id: 'modern' as ThemeType,
      name: '소프트 모던',
      description: '여유로운 공백과 부드러운 컬러를 사용한 세련된 비즈니스 스타일',
      icon: <Palette className="w-8 h-8 text-indigo-500" />,
      color: 'bg-white',
      textColor: 'text-slate-800',
      accent: 'border-indigo-500'
    },
    {
      id: 'minimal' as ThemeType,
      name: '내역 중심 미니멀',
      description: '불필요한 요소를 제거하고 숫자와 텍스트의 가독성을 극대화한 스타일',
      icon: <FileText className="w-8 h-8 text-emerald-500" />,
      color: 'bg-zinc-50',
      textColor: 'text-zinc-900',
      accent: 'border-emerald-500'
    },
    {
      id: 'high-density' as ThemeType,
      name: '하이 덴시티 v4.0 (추천)',
      description: '한 화면에 가장 많은 내역을 보여주는 고밀도 레이아웃 · 네이비/앰버 색상',
      icon: <Layout className="w-8 h-8 text-blue-600" />,
      color: 'bg-[#F3F5F8]',
      textColor: 'text-[#0a1220]',
      accent: 'border-[#0a1220]'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold mb-4 tracking-tight">프로그램 양식 선택</h1>
        <p className="text-slate-600 text-lg">사용자의 업무 스타일에 가장 잘 맞는 인터페이스 디자인을 선택해주세요.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl w-full">
        {templates.map((template, idx) => (
          <motion.button
            key={template.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: -10 }}
            onClick={() => onSelect(template.id)}
            className={`flex flex-col h-full rounded-2xl border-2 transition-all p-8 text-left hover:shadow-2xl bg-white ${template.accent}`}
          >
            <div className="mb-6 p-4 rounded-xl bg-slate-50 w-fit">
              {template.icon}
            </div>
            <h2 className="text-2xl font-bold mb-3">{template.name}</h2>
            <p className="text-slate-500 mb-8 flex-grow leading-relaxed">{template.description}</p>
            
            <div className="flex items-center text-blue-600 font-medium group">
              <span>선택하기</span>
              <CheckCircle2 className="ml-2 w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
