export interface AgentHeaderProps {
  title?: string;
  subtitle?: string;
  badgeText?: string;
  onBadgeClick?: () => void;
}

export interface NaturalLanguageInputProps {
  value: string;
  onChange: (value: string) => void;
  onAudioRecord: () => void;
  placeholder?: string;
  isRecording?: boolean;
  disabled?: boolean;
}
