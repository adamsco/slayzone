import { create } from 'zustand'
import type { Task } from '@slayzone/task/shared'
import type { Project } from '@slayzone/projects/shared'

export interface CreateTaskDefaults {
  status?: Task['status']
  priority?: number
  dueDate?: string | null
}

interface DialogState {
  // Create task
  createTaskOpen: boolean
  createTaskDefaults: CreateTaskDefaults
  openCreateTask: (defaults?: CreateTaskDefaults) => void
  closeCreateTask: () => void

  // Edit task
  editingTask: Task | null
  openEditTask: (task: Task) => void
  closeEditTask: () => void

  // Delete task
  deletingTask: Task | null
  openDeleteTask: (task: Task) => void
  closeDeleteTask: () => void

  // Create project
  createProjectOpen: boolean
  openCreateProject: () => void
  closeCreateProject: () => void

  // Delete project
  deletingProject: Project | null
  openDeleteProject: (project: Project) => void
  closeDeleteProject: () => void

  // Simple booleans
  onboardingOpen: boolean
  openOnboarding: () => void
  closeOnboarding: () => void

  changelogOpen: boolean
  openChangelog: () => void
  closeChangelog: () => void

  searchOpen: boolean
  openSearch: () => void
  closeSearch: () => void

  completeTaskDialogOpen: boolean
  openCompleteTaskDialog: () => void
  closeCompleteTaskDialog: () => void

  showAnimatedTour: boolean
  openAnimatedTour: () => void
  closeAnimatedTour: () => void
}

export const useDialogStore = create<DialogState>()((set) => ({
  createTaskOpen: false,
  createTaskDefaults: {},
  openCreateTask: (defaults) => set({ createTaskOpen: true, createTaskDefaults: defaults ?? {} }),
  closeCreateTask: () => set({ createTaskOpen: false, createTaskDefaults: {} }),

  editingTask: null,
  openEditTask: (task) => set({ editingTask: task }),
  closeEditTask: () => set({ editingTask: null }),

  deletingTask: null,
  openDeleteTask: (task) => set({ deletingTask: task }),
  closeDeleteTask: () => set({ deletingTask: null }),

  createProjectOpen: false,
  openCreateProject: () => set({ createProjectOpen: true }),
  closeCreateProject: () => set({ createProjectOpen: false }),

  deletingProject: null,
  openDeleteProject: (project) => set({ deletingProject: project }),
  closeDeleteProject: () => set({ deletingProject: null }),

  onboardingOpen: false,
  openOnboarding: () => set({ onboardingOpen: true }),
  closeOnboarding: () => set({ onboardingOpen: false }),

  changelogOpen: false,
  openChangelog: () => set({ changelogOpen: true }),
  closeChangelog: () => set({ changelogOpen: false }),

  searchOpen: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),

  completeTaskDialogOpen: false,
  openCompleteTaskDialog: () => set({ completeTaskDialogOpen: true }),
  closeCompleteTaskDialog: () => set({ completeTaskDialogOpen: false }),

  showAnimatedTour: false,
  openAnimatedTour: () => set({ showAnimatedTour: true }),
  closeAnimatedTour: () => set({ showAnimatedTour: false }),
}))
