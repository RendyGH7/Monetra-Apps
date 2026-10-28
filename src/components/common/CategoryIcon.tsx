import React from 'react';
import {
  Utensils,
  Heart,
  Car,
  Receipt,
  ShoppingBag,
  Clapperboard,
  PiggyBank,
  Wallet,
  Gamepad2,
  CircleEllipsis,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';

interface CategoryIconProps {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name,
  color = '#A3AFBC',
  size = 20,
  className = '',
}) => {
  const iconProps = {
    size,
    color,
    strokeWidth: 1.75,
    className,
    'aria-hidden': true,
  };

  switch (name.toLowerCase()) {
    case 'utensils':
    case 'makanan & minuman':
      return <Utensils {...iconProps} />;
    case 'heart':
    case 'kencan & pacaran':
      return <Heart {...iconProps} />;
    case 'car':
    case 'transportasi':
      return <Car {...iconProps} />;
    case 'receipt':
    case 'tagihan & pulsa':
      return <Receipt {...iconProps} />;
    case 'shopping-bag':
    case 'belanja harian':
      return <ShoppingBag {...iconProps} />;
    case 'clapperboard':
    case 'hiburan':
      return <Clapperboard {...iconProps} />;
    case 'piggy-bank':
    case 'tabungan & dana darurat':
      return <PiggyBank {...iconProps} />;
    case 'wallet':
    case 'gaji magang':
      return <Wallet {...iconProps} />;
    case 'gamepad-2':
    case 'bisnis roblox & mlbb':
      return <Gamepad2 {...iconProps} />;
    case 'income':
      return <ArrowDownLeft {...iconProps} />;
    case 'expense':
      return <ArrowUpRight {...iconProps} />;
    case 'sparkles':
      return <Sparkles {...iconProps} />;
    default:
      return <CircleEllipsis {...iconProps} />;
  }
};
