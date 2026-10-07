import {
  AlignLeft,
  ChevronDown,
  CircleSlash,
  CreditCard,
  Hash,
  ListChecks,
  Mail,
  Star,
  Text,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import type { z } from "zod";
import { DropdownSettings } from "@/components/builder/TypeSettings/DropdownSettings";
import { EmailSettings } from "@/components/builder/TypeSettings/EmailSettings";
import type { QuestionSettingsProps } from "@/components/builder/TypeSettings/fields";
import { MultipleChoiceSettings } from "@/components/builder/TypeSettings/MultipleChoiceSettings";
import { NumberSettings } from "@/components/builder/TypeSettings/NumberSettings";
import { RatingSettings } from "@/components/builder/TypeSettings/RatingSettings";
import { TextSettings } from "@/components/builder/TypeSettings/TextSettings";
import { YesNoSettings } from "@/components/builder/TypeSettings/YesNoSettings";
import { ChoiceSummary } from "@/components/results/summaries/ChoiceSummary";
import { NumberSummary } from "@/components/results/summaries/NumberSummary";
import { RatingSummary } from "@/components/results/summaries/RatingSummary";
import { TextSummary } from "@/components/results/summaries/TextSummary";
import type { QuestionSummaryProps } from "@/components/results/summaries/types";
import { YesNoSummary } from "@/components/results/summaries/YesNoSummary";
import { Dropdown } from "@/components/runner/inputs/Dropdown";
import { Email } from "@/components/runner/inputs/Email";
import { LongText } from "@/components/runner/inputs/LongText";
import { MultipleChoice, selectedIds } from "@/components/runner/inputs/MultipleChoice";
import { NumberInput } from "@/components/runner/inputs/NumberInput";
import { Rating } from "@/components/runner/inputs/Rating";
import { ShortText } from "@/components/runner/inputs/ShortText";
import type { QuestionInputProps } from "@/components/runner/inputs/types";
import { YesNo } from "@/components/runner/inputs/YesNo";
import { orderedOptions } from "./options";
import type { JsonValue, Question, QuestionType } from "./types";
import {
  dropdownSchema,
  emailSchema,
  isEmptyAnswer,
  longTextSchema,
  multipleChoiceSchema,
  numberSchema,
  ratingSchema,
  REQUIRED_MESSAGE,
  shortTextSchema,
  yesNoSchema,
} from "./validation";

/**
 * THE question-type registry. Adding a type means adding one entry here (and its
 * backend twin in backend/app/question_types). The builder, the respondent flow
 * and the results screens all read from this object.
 *
 */
export interface QuestionTypeDef {
  label: string;
  icon: LucideIcon;
  /** Chip colours, taken from the --color-type-* tokens. */
  chipClass: string;
  defaultProperties: Record<string, JsonValue>;
  /** Choice types carry a list of options. */
  hasOptions: boolean;
  /** True when the respondent has not answered; mirrors the server's is_empty. */
  isEmpty: (value: JsonValue | undefined) => boolean;
  /** The input rendered by the respondent flow AND by the builder canvas. */
  Input: ComponentType<QuestionInputProps>;
  /** The type-specific controls in the builder's settings panel. */
  Settings: ComponentType<QuestionSettingsProps>;
  /** How the Results > Summary tab shows this type's statistics. */
  Summary: ComponentType<QuestionSummaryProps>;
  /** zod rule for a non-empty answer; mirrors the server's validator for this type. */
  schema: (question: Question) => z.ZodType;
  /** Picking an answer moves on by itself (single-select choice, dropdown, yes/no, rating). */
  autoAdvance: (question: Question) => boolean;
  /**
   * Keyboard shortcut: the new answer for a pressed letter or digit, or undefined if
   * the key means nothing for this type.
   */
  answerForKey: (question: Question, key: string, current: JsonValue | undefined) => JsonValue | undefined;
}

const noAutoAdvance = () => false;
const noKeyAnswer = () => undefined;

export const QUESTION_TYPES: Record<QuestionType, QuestionTypeDef> = {
  short_text: {
    label: "Short Text",
    icon: Text,
    chipClass: "bg-type-text text-type-text-ink",
    defaultProperties: { placeholder: "", max_length: 255 },
    hasOptions: false,
    isEmpty: isEmptyAnswer,
    Input: ShortText,
    Settings: TextSettings,
    Summary: TextSummary,
    schema: shortTextSchema,
    autoAdvance: noAutoAdvance,
    answerForKey: noKeyAnswer,
  },
  long_text: {
    label: "Long Text",
    icon: AlignLeft,
    chipClass: "bg-type-text text-type-text-ink",
    defaultProperties: { placeholder: "", max_length: 5000 },
    hasOptions: false,
    isEmpty: isEmptyAnswer,
    Input: LongText,
    Settings: TextSettings,
    Summary: TextSummary,
    schema: longTextSchema,
    autoAdvance: noAutoAdvance,
    answerForKey: noKeyAnswer,
  },
  multiple_choice: {
    label: "Multiple Choice",
    icon: ListChecks,
    chipClass: "bg-type-choice text-type-choice-ink",
    defaultProperties: { allow_multiple: false, randomize: false, vertical: true },
    hasOptions: true,
    isEmpty: isEmptyAnswer,
    Input: MultipleChoice,
    Settings: MultipleChoiceSettings,
    Summary: ChoiceSummary,
    schema: multipleChoiceSchema,
    autoAdvance: (question) => question.properties.allow_multiple !== true,
    answerForKey: (question, key, current) => {
      const option = orderedOptions(question)[key.charCodeAt(0) - "a".charCodeAt(0)];
      if (!option || !/^[a-z]$/.test(key)) return undefined;
      if (question.properties.allow_multiple !== true) return [option.id];
      const chosen = selectedIds(current);
      return chosen.includes(option.id) ? chosen.filter((id) => id !== option.id) : [...chosen, option.id];
    },
  },
  dropdown: {
    label: "Dropdown",
    icon: ChevronDown,
    chipClass: "bg-type-choice text-type-choice-ink",
    defaultProperties: { placeholder: "Type or select an option", alphabetical: false },
    hasOptions: true,
    isEmpty: isEmptyAnswer,
    Input: Dropdown,
    Settings: DropdownSettings,
    Summary: ChoiceSummary,
    schema: dropdownSchema,
    autoAdvance: () => true,
    answerForKey: noKeyAnswer,
  },
  email: {
    label: "Email",
    icon: Mail,
    chipClass: "bg-type-contact text-type-contact-ink",
    defaultProperties: { placeholder: "name@example.com" },
    hasOptions: false,
    isEmpty: isEmptyAnswer,
    Input: Email,
    Settings: EmailSettings,
    Summary: TextSummary,
    schema: emailSchema,
    autoAdvance: noAutoAdvance,
    answerForKey: noKeyAnswer,
  },
  number: {
    label: "Number",
    icon: Hash,
    chipClass: "bg-type-number text-type-number-ink",
    defaultProperties: { min: null, max: null },
    hasOptions: false,
    isEmpty: isEmptyAnswer,
    Input: NumberInput,
    Settings: NumberSettings,
    Summary: NumberSummary,
    schema: numberSchema,
    autoAdvance: noAutoAdvance,
    answerForKey: noKeyAnswer,
  },
  yes_no: {
    label: "Yes/No",
    icon: CircleSlash,
    chipClass: "bg-type-choice text-type-choice-ink",
    defaultProperties: {},
    hasOptions: false,
    isEmpty: isEmptyAnswer,
    Input: YesNo,
    Settings: YesNoSettings,
    Summary: YesNoSummary,
    schema: yesNoSchema,
    autoAdvance: () => true,
    answerForKey: (_question, key) => (key === "y" ? true : key === "n" ? false : undefined),
  },
  rating: {
    label: "Rating",
    icon: Star,
    chipClass: "bg-type-rating text-type-rating-ink",
    defaultProperties: { steps: 5, shape: "star" },
    hasOptions: false,
    isEmpty: isEmptyAnswer,
    Input: Rating,
    Settings: RatingSettings,
    Summary: RatingSummary,
    schema: ratingSchema,
    autoAdvance: () => true,
    answerForKey: (question, key) => {
      if (!/^[0-9]$/.test(key)) return undefined;
      const steps = typeof question.properties.steps === "number" ? question.properties.steps : 5;
      const rating = key === "0" ? 10 : Number(key); // 0 is the "10" key
      return rating <= steps ? rating : undefined;
    },
  },
};

/** Types shown greyed out with a "Coming soon" label in the Add question modal. */
export const COMING_SOON_TYPES: { label: string; icon: LucideIcon }[] = [
  { label: "File Upload", icon: Upload },
  { label: "Payment", icon: CreditCard },
];

/**
 * Validates one answer: null when fine, otherwise the message to show. Empty answers
 * only fail when the question is required.
 */
export function validateAnswer(question: Question, value: JsonValue | undefined): string | null {
  const definition = QUESTION_TYPES[question.type];
  if (definition.isEmpty(value)) return question.required ? REQUIRED_MESSAGE : null;
  const result = definition.schema(question).safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid answer");
}
