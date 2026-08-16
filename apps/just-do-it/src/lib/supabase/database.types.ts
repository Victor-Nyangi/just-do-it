export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskCategory = 'personal' | 'workout' | 'reading' | 'hobby' | 'errand' | 'other'
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'
export type GoalStatus = 'active' | 'completed' | 'paused' | 'cancelled'
export type GoalPeriod = 'week' | 'month' | 'year'
export type HabitFrequency = 'daily' | 'weekly'
export type BookStatus = 'want_to_read' | 'reading' | 'finished' | 'abandoned'

type Relationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          status: TaskStatus
          priority: TaskPriority
          due_date: string | null
          completed_at: string | null
          category: TaskCategory
          recurrence: TaskRecurrence
          recurrence_interval: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          due_date?: string | null
          completed_at?: string | null
          category?: TaskCategory
          recurrence?: TaskRecurrence
          recurrence_interval?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
        Relationships: Relationship[]
      }
      goals: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          status: GoalStatus
          target_date: string | null
          period: GoalPeriod
          progress: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          description?: string | null
          status?: GoalStatus
          target_date?: string | null
          period: GoalPeriod
          progress?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['goals']['Insert']>
        Relationships: Relationship[]
      }
      habits: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          frequency: HabitFrequency
          target: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          description?: string | null
          frequency?: HabitFrequency
          target?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['habits']['Insert']>
        Relationships: Relationship[]
      }
      habit_completions: {
        Row: {
          id: string
          habit_id: string
          completed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          habit_id: string
          completed_at?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['habit_completions']['Insert']>
        Relationships: Relationship[]
      }
      books: {
        Row: {
          id: string
          user_id: string
          title: string
          author: string | null
          status: BookStatus
          started_at: string | null
          finished_at: string | null
          rating: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          author?: string | null
          status?: BookStatus
          started_at?: string | null
          finished_at?: string | null
          rating?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['books']['Insert']>
        Relationships: Relationship[]
      }
      lists: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          icon: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          description?: string | null
          icon?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['lists']['Insert']>
        Relationships: Relationship[]
      }
      list_items: {
        Row: {
          id: string
          list_id: string
          title: string
          completed: boolean
          position: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          list_id: string
          title: string
          completed?: boolean
          position?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['list_items']['Insert']>
        Relationships: Relationship[]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      task_status: TaskStatus
      task_priority: TaskPriority
      task_category: TaskCategory
      task_recurrence: TaskRecurrence
      goal_status: GoalStatus
      goal_period: GoalPeriod
      habit_frequency: HabitFrequency
      book_status: BookStatus
    }
    CompositeTypes: Record<string, never>
  }
}
