import { avatarColor, initials } from "../../format";

interface Props {
  name: string;
  size?: number;
}

export function PlayerAvatar({ name, size = 40 }: Props) {
  const bg = avatarColor(name);
  const fontSize = size <= 34 ? 11 : size >= 50 ? 18 : 14;

  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-jakarta font-bold text-white select-none"
      style={{ width: size, height: size, backgroundColor: bg, fontSize }}
    >
      {initials(name)}
    </div>
  );
}
