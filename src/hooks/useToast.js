import * as React from "react"

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 5000

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
}

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

const toastTimeouts = new Map()
const autoDismissTimeouts = new Map()

const addToRemoveQueue = (toastId) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: actionTypes.REMOVE_TOAST,
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state, action) => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners = []

let memoryState = { toasts: [] }

function dispatch(action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

function toast({ ...props }) {
  const id = genId()

  const update = (props) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id })

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  if (props.duration != null) {
    if (autoDismissTimeouts.has(id)) {
      clearTimeout(autoDismissTimeouts.get(id))
    }
    const timeout = setTimeout(() => {
      autoDismissTimeouts.delete(id)
      dismiss()
    }, props.duration)
    autoDismissTimeouts.set(id, timeout)
  }

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  }
}

/**
 * Undo toast - shows a toast with an undo button
 * The action is delayed and can be cancelled
 * 
 * @param {Object} options
 * @param {string} options.title - Toast title
 * @param {string} options.description - Toast description
 * @param {Function} options.action - The destructive action to perform
 * @param {Function} options.onUndo - Callback when undo is clicked (optional)
 * @param {number} options.duration - Time before action executes (default 5000ms)
 * @returns {Promise} Resolves when action completes, rejects if undone
 */
function undoableToast({ title, description, action, onUndo, duration = 5000 }) {
  return new Promise((resolve, reject) => {
    let cancelled = false
    let timeoutId = null
    
    const { dismiss, update } = toast({
      title,
      description,
      duration: duration + 1000, // Keep toast visible slightly longer
      action: {
        label: 'Undo',
        onClick: () => {
          cancelled = true
          if (timeoutId) clearTimeout(timeoutId)
          dismiss()
          onUndo?.()
          reject(new Error('Action cancelled by user'))
        }
      },
      variant: 'default',
    })
    
    // Execute action after delay
    timeoutId = setTimeout(async () => {
      if (!cancelled) {
        try {
          await action()
          resolve()
        } catch (error) {
          update({
            title: 'Action failed',
            description: error.message,
            variant: 'destructive',
          })
          reject(error)
        }
      }
    }, duration)
  })
}

export { useToast, toast, undoableToast }
