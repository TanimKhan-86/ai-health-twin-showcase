import { View, ViewProps, Text, TextProps } from "react-native";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }: ViewProps) {
    return (
        <View
            className={cn(
                "rounded-2xl border border-slate-200 bg-white shadow-sm",
                "dark:bg-slate-800 dark:border-slate-700",
                className
            )}
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }: ViewProps) {
    return (
        <View className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
    );
}

export function CardTitle({ className, ...props }: TextProps) {
    return (
        <Text
            className={cn(
                "text-2xl font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100",
                className
            )}
            {...props}
        />
    );
}

export function CardContent({ className, ...props }: ViewProps) {
    return <View className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ViewProps) {
    return (
        <View
            className={cn("flex flex-row items-center p-6 pt-0", className)}
            {...props}
        />
    );
}
