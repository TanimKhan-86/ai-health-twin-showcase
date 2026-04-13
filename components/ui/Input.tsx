import { TextInput, TextInputProps, View, Text } from "react-native";
import { cn } from "../../lib/utils";

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerClassName?: string;
}

export function Input({
    className,
    containerClassName,
    label,
    error,
    ...props
}: InputProps) {
    return (
        <View className={cn("space-y-2", containerClassName)}>
            {label && (
                <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {label}
                </Text>
            )}
            <TextInput
                placeholderTextColor="#94a3b8"
                className={cn(
                    "flex h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400",
                    "dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500",
                    error && "border-status-error",
                    className
                )}
                {...props}
            />
            {error && <Text className="text-xs text-status-error">{error}</Text>}
        </View>
    );
}
