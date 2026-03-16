import React from 'react'
import { TaskDetailPage, type TaskDetailPageProps } from './TaskDetailPage'
import { taskDetailCache } from './taskDetailCache'

export type TaskDetailDataLoaderProps = Omit<TaskDetailPageProps, 'initialData'>

/**
 * Suspense wrapper for TaskDetailPage.
 * Suspends until task data is loaded, then renders TaskDetailPage with initialData.
 * The parent must wrap this in a <Suspense> boundary.
 */
export const TaskDetailDataLoader = React.memo(function TaskDetailDataLoader(
  props: TaskDetailDataLoaderProps
): React.JSX.Element {
  const data = taskDetailCache.useData('taskDetail', props.taskId)
  return <TaskDetailPage {...props} initialData={data} />
})
