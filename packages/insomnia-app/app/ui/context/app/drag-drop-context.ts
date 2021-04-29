import { DragDropContext } from 'react-dnd';
import DNDBackend from '../../dnd-backend';
// @ts-expect-error
export default DragDropContext(DNDBackend);
