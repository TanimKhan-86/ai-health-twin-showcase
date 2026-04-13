import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import { useState } from "react";

// Utility for class merging (similar to shadcn/ui) already imported


const buttonVariants = cva(
    "flex-row items-center justify-center rounded-xl px-4 py-3",
    {
        variants: {
            variant: {
                default: "bg-brand-primary",
                destructive: "bg-status-error",
                outline: "border border-brand-primary bg-transparent",
                secondary: "bg-brand-secondary",
                ghost: "bg-transparent",
                link: "text-brand-primary underline-offset-4",
            },
            size: {
                default: "h-12",
                sm: "h-9 px-3",
                lg: "h-14 px-8",
                icon: "h-10 w-10 p-0",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

interface ButtonProps
    extends Omit<ComponentProps<typeof Pressable>, "children">,
    VariantProps<typeof buttonVariants> {
    label?: string;
    labelClasses?: string;
    icon?: ReactNode;
    children?: ReactNode;
}

export function Button({
    className,
    variant,
    size,
    label,
    labelClasses,
    children,
    icon,
    ...props
}: ButtonProps) {
    const [hovered, setHovered] = useState(false);
    const isDisabled = !!props.disabled;

    return (
        <Pressable
            className={cn(buttonVariants({ variant, size, className }))}
            onHoverIn={() => !isDisabled && setHovered(true)}
            onHoverOut={() => setHovered(false)}
            style={({ pressed }) => [
                hovered && !isDisabled ? styles.hovered : undefined,
                pressed && !isDisabled ? styles.pressed : undefined,
                Platform.OS === "web"
                    ? ({ cursor: isDisabled ? "not-allowed" : "pointer" } as any)
                    : undefined,
            ]}
            {...props}
        >
            {icon && <View className="mr-2">{icon}</View>}
            {label ? (
                <Text
                    className={cn(
                        "text-white font-medium text-base",
                        variant === "outline" && "text-brand-primary",
                        variant === "ghost" && "text-brand-primary",
                        variant === "link" && "text-brand-primary underline",
                        labelClasses
                    )}
                >
                    {label}
                </Text>
            ) : (
                children
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    hovered: {
        transform: [{ translateY: -1 }],
        opacity: 0.97,
    },
    pressed: {
        opacity: 0.9,
        transform: [{ scale: 0.99 }],
    },
});
