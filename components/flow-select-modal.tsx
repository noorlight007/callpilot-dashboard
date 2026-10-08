"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface FlowSelectModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
    flowName: string
}

export function FlowSelectModal({ open, onOpenChange, onConfirm, flowName }: FlowSelectModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md glass rounded-3xl bg-white/90 dark:bg-gray-950/90 animate-scale-in shadow-2xl shadow-indigo-500/20">
                <DialogHeader>
                    <DialogTitle className="text-xl font-extrabold gradient-text">Select Confirmation</DialogTitle>
                    <DialogDescription className="text-base pt-2">
                        Are you sure you want to select <strong>{flowName}</strong>?
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-3 sm:justify-end mt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 sm:flex-none border-2 border-primary/20 bg-white/60 dark:bg-white/5 hover:bg-primary/10 font-semibold h-11 px-8 rounded-xl"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        className="flex-1 sm:flex-none h-11 px-8 gradient-bg text-white font-semibold rounded-xl border-0 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                    >
                        Select
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
