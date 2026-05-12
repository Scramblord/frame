const powerStrikeStyle = {
  textDecoration: "line-through" as const,
  textDecorationColor: "var(--color-accent)",
  textDecorationThickness: "3px" as const,
};

type KnowledgeIsPowerMoneyProps = {
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  id?: string;
};

export function KnowledgeIsPowerMoney({
  as: Tag = "span",
  className,
  id,
}: KnowledgeIsPowerMoneyProps) {
  return (
    <Tag className={className} id={id}>
      Knowledge is{" "}
      <span style={powerStrikeStyle}>Power</span>
      <span className="font-bold italic"> Money.</span>
    </Tag>
  );
}
