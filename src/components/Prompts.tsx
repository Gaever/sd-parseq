import { Alert, Box, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Link, MenuItem, Tooltip, Typography } from "@mui/material";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Unstable_Grid2';
import { Stack } from '@mui/system';
import { Timeline, TimelineEffect, TimelineRow } from '@xzdarcy/react-timeline-editor';
import _ from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdvancedParseqPrompt, AdvancedParseqPromptsV2, OverlapType, ParseqPrompts, SimpleParseqPrompts } from "../ParseqUI";
import StyledSwitch from './StyledSwitch';
import { frameToBeat, frameToSec } from "../utils/maths";
import type {} from '@mui/material/themeCssVarsAugmentation';
import { experimental_extendTheme as extendTheme } from "@mui/material/styles";
import { themeFactory } from "../theme";
import useDebouncedEffect from "use-debounced-effect";
import JSON5 from 'json5';

interface PromptsProps {
    initialPrompts: AdvancedParseqPromptsV2,
    lastFrame: number,
    keyframeLock: 'frames' | 'beats' | 'seconds',
    bpm: number,
    fps: number,
    markDirty: (active: boolean) => void,
    commitChange: (event: any) => void
}

const DEFAULT_PROMPTS: AdvancedParseqPromptsV2 = {
    format: 'v2' as const,
    enabled: true,
    commonPrompt: {
        name: 'Common',
        positive: "",
        negative: "",
        allFrames: true,
        from: 0,
        to: 0,
        overlap: {
            inFrames: 0,
            outFrames: 0,
            type: "none" as "none" | "linear" | "custom",
            custom: "prompt_weight_1",
        }
    },
    commonPromptPos: 'append',
    promptList: [{
        name: 'Prompt 1',
        positive: "",
        negative: "",
        allFrames: true,
        from: 0,
        to: 0,
        overlap: {
            inFrames: 0,
            outFrames: 0,
            type: "none" as "none" | "linear" | "custom",
            custom: "prompt_weight_1",
        }
    }]
}

function stringToPrompt(value: string, startFrame: number, endFrame: number|undefined) {
    const [pos, neg] = value.split('--neg', 2);
    const newPrompt: AdvancedParseqPrompt = _.cloneDeep(DEFAULT_PROMPTS.promptList[0]);
    newPrompt.positive = pos?.trim() || '';
    newPrompt.negative = neg?.trim() || '';
    newPrompt.allFrames = false;
    newPrompt.from = startFrame;
    newPrompt.to = endFrame||startFrame+1;
    return newPrompt;
}


export function convertPrompts(oldPrompts: ParseqPrompts, lastFrame: number): AdvancedParseqPromptsV2 {
    //@ts-ignore
    if (oldPrompts.format === 'v2') {
        const v2Prompt = (oldPrompts as AdvancedParseqPromptsV2);
        if (v2Prompt.commonPromptPos === undefined) {
            v2Prompt.commonPromptPos = 'append';
        }
        return v2Prompt;
    }

    const defaultPrompts = _.cloneDeep(DEFAULT_PROMPTS);
    defaultPrompts.commonPrompt.to = lastFrame;
    defaultPrompts.promptList[0].to = lastFrame;

    if (!oldPrompts) {
        return defaultPrompts;
    } else if (!Array.isArray(oldPrompts)) {
        // Old single-prompt format
        defaultPrompts.promptList[0].positive = (oldPrompts as SimpleParseqPrompts).positive;
        defaultPrompts.promptList[0].negative = (oldPrompts as SimpleParseqPrompts).negative;
        return defaultPrompts;
    } else {
        // Old multi-prompt format
        defaultPrompts.promptList = oldPrompts;
        defaultPrompts.enabled = oldPrompts[0].enabled === undefined || oldPrompts[0].enabled === null ? true : oldPrompts[0].enabled;
        return defaultPrompts;
    }

}

export function Prompts(props: PromptsProps) {
    //const [prompts, setPrompts] = useState<AdvancedParseqPrompts>(props.initialPrompts);
    const [unsavedPrompts, setUnsavedPrompts] = useState<AdvancedParseqPromptsV2>(_.cloneDeep(props.initialPrompts));
    const [quickPreviewPosition, setQuickPreviewPosition] = useState(0);
    const [quickPreview, setQuickPreview] = useState("");
    const [promptWarning, setPromptWarning] = useState<string|undefined>();
    const theme = extendTheme(themeFactory());


    // Copy the initial prompts into the unsaved prompts
    // unless  the initial prompts have a marker indicating they have just looped around
    // from a previous update via commitChanges below.
    useEffect(() => {
        if (props.initialPrompts
            // HACK: This is a hack to prevent infinite loops: if the sentinel is set,
            // we know that the prompts were set in this child component so we can ignore the update when
            // they come back through. If the sentinel is not set, the new prompts may be from a document reversion
            // or other change from outside this component.
            // The sentinel must be stripped before any kind of persistence.
            //@ts-ignore
            && !props.initialPrompts.promptList[0].sentinel) {
            console.log('resetting prompts...');
            setUnsavedPrompts(_.cloneDeep(props.initialPrompts));
        }
    }, [props.initialPrompts]);


    // Notify the parent that we have unsaved changes if the unsaved prompts are different from the initial prompts
    useEffect(() => props.markDirty(!_.isEqual(props.initialPrompts, unsavedPrompts)),
        [props, props.markDirty, props.initialPrompts, unsavedPrompts]);

    // Call the parent's callback on every prompt change
    const commitChanges = useCallback((newPrompts: AdvancedParseqPromptsV2) => {
        // HACK: This is a hack to prevent infinite loops: if the sentinel is set,
        // we know that the prompts were set in this child component so we can ignore the update when
        // they come back through.
        //@ts-ignore HACK
        newPrompts.sentinel = true;

        setUnsavedPrompts(newPrompts);
        props.commitChange(_.cloneDeep(newPrompts));

    }, [props]);

    const getNextPromptIndex = useCallback(() => {
        const nextPromptIndex = unsavedPrompts.promptList.length;
        let nextPromptNameNumber = nextPromptIndex + 1;
        //eslint-disable-next-line no-loop-func
        while (unsavedPrompts.promptList.some(prompt => prompt.name === 'Prompt ' + nextPromptNameNumber)) {
            nextPromptNameNumber++;
        }
        return { nextPromptIndex, nextPromptNameNumber };
    }, [unsavedPrompts]);

    const promptInput = useCallback((index: number, positive: boolean) => {

        const posNegStr = positive ? 'positive' : 'negative';
        const isCommonPrompt = index < 0;
        const unsavedPrompt = isCommonPrompt ? unsavedPrompts.commonPrompt : unsavedPrompts.promptList[index];
        const initPrompt = isCommonPrompt ?  props.initialPrompts.commonPrompt : props.initialPrompts.promptList[index];

        const hasUnsavedChanges = initPrompt && (unsavedPrompt[posNegStr] !== initPrompt[posNegStr]);

        return <TextField
            multiline
            // test-id={`idx`}
            data-testid={`prompt-${positive ? 'pos' : 'neg'}-idx-${index}`}
            minRows={2}
            maxRows={16}
            fullWidth={true}
            style={{ paddingRight: '20px' }}
            label={(positive ? "Positive" : "Negative") + " " + unsavedPrompt?.name?.toLowerCase()}
            value={unsavedPrompt[posNegStr]}
            placeholder={(isCommonPrompt && unsavedPrompts.commonPromptPos === 'template') ? "your prefix [prompt] your suffix" : ""}
            InputProps={{
                style: { fontSize: '0.7em', fontFamily: 'Monospace', color: positive ? theme.vars.palette.positive.main : theme.vars.palette.negative.main },
                sx: { background: hasUnsavedChanges ? theme.vars.palette.unsavedbg.main : '', },
                endAdornment: hasUnsavedChanges ? '🖊️' : ''
            }}
            onBlur={(e: any) => {      
                console.log('ON BLUR')
                commitChanges(unsavedPrompts);
            }}
            onKeyDown={(e: any) => {
                if (e.key === 'Enter') {
                    if (e.shiftKey) {
                        setTimeout(() => e.target.blur());
                        e.preventDefault();
                    }
                } else if (e.key === 'Escape') {
                    unsavedPrompt[posNegStr] = initPrompt[posNegStr];
                    setUnsavedPrompts({ ...unsavedPrompts });
                    setTimeout(() => e.target.blur());
                    e.preventDefault();
                }
            }}
            onChange={(e: any) => {
                console.log('ON CHANGE')
                if (isCommonPrompt
                    && unsavedPrompts.commonPromptPos === 'template'
                    && e.target.value.trim() !== ''
                    && !e.target.value.includes('[prompt]')) {
                        setPromptWarning("In template mode, common prompts must either be empty or contain '[prompt]'.");
                } else {
                    setPromptWarning(undefined);                  
                }                     
                unsavedPrompt[posNegStr] = e.target.value;
                setUnsavedPrompts({ ...unsavedPrompts });  
            }}
            InputLabelProps={{ shrink: true, style: { fontSize: '0.9em' } }}
            size="small"
            variant="outlined" />
    }, [commitChanges, props, unsavedPrompts, theme]);

    const addPrompt = useCallback(() => {
        const { nextPromptIndex, nextPromptNameNumber } = getNextPromptIndex();
        const newPrompts = { ...unsavedPrompts };
        newPrompts.promptList = [
            ...unsavedPrompts.promptList,
            {
                positive: "",
                negative: "",
                from: Math.min(props.lastFrame, unsavedPrompts.promptList[nextPromptIndex - 1].to + 1),
                to: Math.min(props.lastFrame, unsavedPrompts.promptList[nextPromptIndex - 1].to + 50),
                allFrames: false,
                name: 'Prompt ' + nextPromptNameNumber,
                overlap: {
                    inFrames: 0,
                    outFrames: 0,
                    type: "none" as const,
                    custom: "prompt_weight_" + nextPromptNameNumber,
                }
            }
        ];
        commitChanges(newPrompts);
    }, [getNextPromptIndex, unsavedPrompts, props.lastFrame, commitChanges]);

    const delPrompt = useCallback((idxToDelete: number) => {
        const newPrompts = { ...unsavedPrompts };
        newPrompts.promptList = unsavedPrompts.promptList.filter((_, idx) => idx !== idxToDelete);
        commitChanges(newPrompts);
    }, [unsavedPrompts, commitChanges]);


    const composableDiffusionWarning = useCallback((idx: number) => {
        const prompt = unsavedPrompts.promptList[idx];
        const overlappingPrompts = unsavedPrompts.promptList.filter(p => p !== prompt
            && p.from <= prompt.to
            && prompt.from <= p.to);

        if (overlappingPrompts.length > 0
            && (prompt.positive.match(/\sAND\s/)
                || prompt.negative.match(/\sAND\s/))) {
            return <Alert severity="warning">
                Warning: Parseq uses <Link href="https://github.com/AUTOMATIC1111/stable-diffusion-webui/wiki/Features#composable-diffusion">composable diffusion</Link> to combine overlapping prompts.
                &nbsp;{prompt.name} overlaps with the following: <strong>{overlappingPrompts.map(p => p.name).join(', ')}</strong>.
                But {prompt.name}  also appears to contain its own composable diffusion sections (<span style={{ fontFamily: 'monospace' }}>&#8230; AND &#8230;</span>).
                This may lead to unexpected results. Check your rendered prompts in the preview window and consider removing the composable diffusion sections  from {prompt.name} if possible.
            </Alert>
        }
        return <></>;
    }, [unsavedPrompts]);


    const displayFadeOptions = useCallback((promptIdx: number) => {
        const prompt = unsavedPrompts.promptList[promptIdx];

        return <>
            <Tooltip arrow placement="top" title="Specify how this prompt will be weighted if it overlaps with other prompts.">
                <TextField
                    select
                    fullWidth={false}
                    size="small"
                    style={{ width: '7em', marginLeft: '5px' }}
                    label={"Overlap weight: "}
                    InputLabelProps={{ shrink: true, }}
                    InputProps={{ style: { fontSize: '0.75em' } }}
                    value={prompt.overlap.type}
                    onChange={(e: any) => {
                        unsavedPrompts.promptList[promptIdx].overlap.type = (e.target.value as OverlapType);
                        commitChanges({ ...unsavedPrompts });
                    }}
                >
                    <MenuItem value={"none"}>Fixed</MenuItem>
                    <MenuItem value={"linear"}>Linear fade </MenuItem>
                    <MenuItem value={"custom"}>Custom</MenuItem>
                </TextField>
            </Tooltip>
            <Tooltip arrow placement="top" title="Length of fade-in (frames).">
                <TextField
                    type="number"
                    size="small"
                    style={{ paddingBottom: '0px', width: '5em', display: prompt.overlap.type !== "linear" ? "none" : "" }}
                    label={"In"}
                    disabled={prompt.overlap.type === "none"}
                    inputProps={{
                        style: { fontFamily: 'Monospace', fontSize: '0.75em' },
                        sx: { background: unsavedPrompts.promptList[promptIdx].overlap.inFrames !== props.initialPrompts.promptList[promptIdx]?.overlap?.inFrames ? theme.vars.palette.unsavedbg.main : '', },
                    }}
                    InputLabelProps={{ shrink: true, }}
                    value={prompt.overlap.inFrames}
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                            unsavedPrompts.promptList[promptIdx].overlap.inFrames = val;
                            setUnsavedPrompts({ ...unsavedPrompts });
                        }
                    }}
                    onBlur={(e) => {
                        if (parseInt(e.target.value) > (unsavedPrompts.promptList[promptIdx].to - unsavedPrompts.promptList[promptIdx].from)) {
                            unsavedPrompts.promptList[promptIdx].overlap.inFrames = (unsavedPrompts.promptList[promptIdx].to - unsavedPrompts.promptList[promptIdx].from);
                        }
                        if (parseInt(e.target.value) < 0) {
                            unsavedPrompts.promptList[promptIdx].overlap.inFrames = 0;
                        }
                        commitChanges({ ...unsavedPrompts });
                    }}
                    onKeyDown={(e: any) => {
                        if (e.key === 'Enter') {
                            setTimeout(() => e.target.blur());
                            e.preventDefault();
                        } else if (e.key === 'Escape') {
                            unsavedPrompts.promptList[promptIdx].overlap.inFrames = props.initialPrompts.promptList[promptIdx]?.overlap?.inFrames;
                            setUnsavedPrompts({ ...unsavedPrompts });
                            setTimeout(() => e.target.blur());
                            e.preventDefault();
                        }
                    }}
                />
            </Tooltip>
            <Tooltip arrow placement="top" title="Length of fade-out (frames)">
                <TextField
                    type="number"
                    size="small"
                    style={{ paddingBottom: '0px', width: '5em', display: prompt.overlap.type !== "linear" ? "none" : "" }}
                    label={"Out"}
                    disabled={prompt.overlap.type === "none"}
                    inputProps={{
                        style: { fontFamily: 'Monospace', fontSize: '0.75em' },
                        sx: { background: unsavedPrompts.promptList[promptIdx].overlap.outFrames !== props.initialPrompts.promptList[promptIdx]?.overlap?.outFrames ? theme.vars.palette.unsavedbg.main : '', },
                    }}
                    InputLabelProps={{ shrink: true, }}
                    value={prompt.overlap.outFrames}
                    onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value)) {
                            unsavedPrompts.promptList[promptIdx].overlap.outFrames = value;
                            setUnsavedPrompts({ ...unsavedPrompts });
                        }
                    }}
                    onBlur={(e) => {
                        const value = parseInt(e.target.value);
                        if (value > (unsavedPrompts.promptList[promptIdx].to - unsavedPrompts.promptList[promptIdx].from)) {
                            unsavedPrompts.promptList[promptIdx].overlap.outFrames = (unsavedPrompts.promptList[promptIdx].to - unsavedPrompts.promptList[promptIdx].from);
                        } else if (value < 0) {
                            unsavedPrompts.promptList[promptIdx].overlap.outFrames = 0;
                        } else if (isNaN(value)) {
                            unsavedPrompts.promptList[promptIdx].overlap.outFrames = props.initialPrompts.promptList[promptIdx].overlap.outFrames;
                        }
                        commitChanges({ ...unsavedPrompts });
                    }}
                    onKeyDown={(e: any) => {
                        if (e.key === 'Enter') {
                            setTimeout(() => e.target.blur());
                            e.preventDefault();
                        } else if (e.key === 'Escape') {
                            unsavedPrompts.promptList[promptIdx].overlap.outFrames = props.initialPrompts.promptList[promptIdx].overlap.outFrames;
                            setUnsavedPrompts({ ...unsavedPrompts });
                            setTimeout(() => e.target.blur());
                            e.preventDefault();
                        }
                    }}
                />
            </Tooltip>
            <Tooltip arrow placement="top" title="If fade mode is custom, the weight during the fade will be the result of the parseq formula you specify here.">
                <TextField
                    type="string"
                    size="small"
                    style={{ marginLeft: '10px', display: prompt.overlap.type !== "custom" ? "none" : "" }}
                    label={"Custom formula"}
                    disabled={prompt.overlap.type !== "custom"}
                    inputProps={{
                        style: { fontFamily: 'Monospace', fontSize: '0.75em' },
                        sx: { background: unsavedPrompts.promptList[promptIdx].overlap.custom !== props.initialPrompts.promptList[promptIdx]?.overlap?.custom ? theme.vars.palette.unsavedbg.main : '', },
                    }}
                    InputLabelProps={{ shrink: true, }}
                    value={prompt.overlap.custom}
                    onChange={(e) => {
                        unsavedPrompts.promptList[promptIdx].overlap.custom = e.target.value;
                        setUnsavedPrompts({ ...unsavedPrompts });
                    }}
                    onBlur={(e) => {
                        commitChanges({ ...unsavedPrompts });
                    }}
                    onKeyDown={(e: any) => {
                        if (e.key === 'Enter') {
                            setTimeout(() => e.target.blur());
                            e.preventDefault();
                        } else if (e.key === 'Escape') {
                            unsavedPrompts.promptList[promptIdx].overlap.custom = props.initialPrompts.promptList[promptIdx].overlap.custom;
                            setUnsavedPrompts({ ...unsavedPrompts });
                            setTimeout(() => e.target.blur());
                            e.preventDefault();
                        }
                    }}

                />
            </Tooltip>
        </>
    }, [unsavedPrompts, commitChanges, props, theme]);


    const displayPrompts = useCallback((advancedPrompts: AdvancedParseqPromptsV2) =>
        <Grid container xs={12} sx={{ paddingTop: '0', paddingBottom: '0' }}>
            {
                advancedPrompts.promptList.map((prompt, idx) =>
                    <Box key={"prompt-" + idx} sx={{ width: '100%', padding: 0, marginTop: 1, marginRight: 2, border: 0, borderRadius: 1 }} >
                        <Grid xs={12} style={{ padding: 0, margin: 0, border: 0 }}>

                            <Box sx={{ display: 'flex', justifyContent: 'left', alignItems: 'center', width: '100%' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'left', alignItems: 'center', width: '75%' }}>
                                    <h5>{prompt.name} –</h5>
                                    <Tooltip arrow placement="top" title="Make this prompt active for the whole animation">
                                        <FormControlLabel
                                            style={{ fontSize: '0.75em', paddingLeft: '10px' }}
                                            control={
                                                <Checkbox
                                                    checked={prompt.allFrames}
                                                    onChange={(e) => {
                                                        unsavedPrompts.promptList[idx].allFrames = e.target.checked;
                                                        commitChanges({ ...unsavedPrompts });
                                                    }}
                                                    size='small' />
                                            } label={<Box component="div" fontSize="0.75em">All frames OR</Box>} />
                                    </Tooltip>
                                    <Tooltip arrow placement="top" title="Frame number where this prompt begins">
                                        <TextField
                                            type="number"
                                            size="small"
                                            style={{ paddingBottom: '0px', width: '5em' }}
                                            id={"from" + (idx + 1)}
                                            label={"From"}
                                            disabled={prompt.allFrames}
                                            inputProps={{
                                                style: { fontFamily: 'Monospace', fontSize: '0.75em' },
                                                sx: { background: unsavedPrompts.promptList[idx].from !== props.initialPrompts.promptList[idx]?.from ? theme.vars.palette.unsavedbg.main : '', },
                                            }}
                                            InputLabelProps={{ shrink: true, }}
                                            value={prompt.from}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value);
                                                if (!isNaN(value)) {
                                                    unsavedPrompts.promptList[idx].from = value;
                                                    setUnsavedPrompts({ ...unsavedPrompts });
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = parseInt(e.target.value);
                                                if (value >= unsavedPrompts.promptList[idx].to) {
                                                    unsavedPrompts.promptList[idx].from = unsavedPrompts.promptList[idx].to;
                                                }
                                                commitChanges({ ...unsavedPrompts });
                                            }}
                                            onKeyDown={(e: any) => {
                                                if (e.key === 'Enter') {
                                                    setTimeout(() => e.target.blur());
                                                    e.preventDefault();
                                                } else if (e.key === 'Escape') {
                                                    unsavedPrompts.promptList[idx].from = props.initialPrompts.promptList[idx].from;
                                                    setUnsavedPrompts({ ...unsavedPrompts });
                                                    setTimeout(() => e.target.blur());
                                                    e.preventDefault();
                                                }
                                            }}
                                        />
                                    </Tooltip>
                                    <Tooltip arrow placement="top" title="Frame number where this prompt ends">
                                        <TextField
                                            type="number"
                                            size="small"
                                            style={{ paddingBottom: '0px', width: '5em' }}
                                            id={"to" + (idx + 1)}
                                            label={"To"}
                                            disabled={prompt.allFrames}
                                            inputProps={{
                                                style: { fontFamily: 'Monospace', fontSize: '0.75em' },
                                                sx: { background: unsavedPrompts.promptList[idx].to !== props.initialPrompts.promptList[idx]?.to ? theme.vars.palette.unsavedbg.main : '', },
                                            }}
                                            InputLabelProps={{ shrink: true, }}
                                            value={prompt.to}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value);
                                                if (!isNaN(value)) {
                                                    unsavedPrompts.promptList[idx].to = value;
                                                    setUnsavedPrompts({ ...unsavedPrompts });
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const value = parseInt(e.target.value);
                                                if (value <= unsavedPrompts.promptList[idx].from) {
                                                    unsavedPrompts.promptList[idx].to = unsavedPrompts.promptList[idx].from;
                                                } else if (value >= props.lastFrame) {
                                                    unsavedPrompts.promptList[idx].to = props.lastFrame;
                                                }
                                                commitChanges({ ...unsavedPrompts });
                                            }}
                                            onKeyDown={(e: any) => {
                                                if (e.key === 'Enter') {
                                                    setTimeout(() => e.target.blur());
                                                    e.preventDefault();
                                                } else if (e.key === 'Escape') {
                                                    unsavedPrompts.promptList[idx].to = props.initialPrompts.promptList[idx].to;
                                                    setUnsavedPrompts({ ...unsavedPrompts });
                                                    setTimeout(() => e.target.blur());
                                                    e.preventDefault();
                                                }
                                            }}
                                        />
                                    </Tooltip>
                                    {displayFadeOptions(idx)}
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'right', alignItems: 'center', paddingRight: '15px', width: '25%' }}>
                                    <Button
                                        disabled={unsavedPrompts.promptList.length < 2}
                                        size="small"
                                        variant="outlined"
                                        color='warning'
                                        style={{ marginLeft: '40px', float: 'right', fontSize: '0.75em' }}
                                        onClick={(e) => delPrompt(idx)}>
                                        ❌ Delete prompt {idx+1}
                                    </Button>
                                </Box>
                            </Box>
                        </Grid>
                        <Grid container xs={12} style={{ margin: 0, padding: 0 }}>
                            <Grid xs={6} style={{ margin: 0, padding: 0 }}>
                                {promptInput(idx, true)}
                            </Grid>
                            <Grid xs={6} style={{ margin: 0, padding: 0 }}>
                                {promptInput(idx, false)}
                            </Grid>
                            <Grid xs={12}>
                                {composableDiffusionWarning(idx)}
                            </Grid>
                        </Grid>
                    </Box>)
            }
            {(advancedPrompts.commonPrompt.positive || advancedPrompts.commonPrompt.negative || advancedPrompts.promptList.length > 1) &&
                <Box sx={{ width: '100%', padding: 0, marginTop: 2, marginRight: 2, border: 0,  borderRadius: 1 }} >
                    <Grid container xs={12} style={{ margin: 0, padding: 0 }}>
                        <Grid xs={12} style={{ margin: 0, padding: 0 }}>
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'left', alignItems: 'center', width: '100%' }}>
                                <h5>Common prompt – </h5>
                                <TextField
                                select
                                fullWidth={false}
                                size="small"
                                style={{ width: '12em'}}
                                label={"Position: "}
                                InputLabelProps={{ shrink: true, }}
                                InputProps={{ style: { fontSize: '0.75em' } }}
                                value={advancedPrompts.commonPromptPos}
                                onChange={(e: any) => {
                                    advancedPrompts.commonPromptPos = (e.target.value as "append"|"prepend"|"template");
                                    commitChanges({ ...unsavedPrompts });
                                }}
                            >
                                    <MenuItem value={"append"}>Append to all prompts</MenuItem>
                                    <MenuItem value={"prepend"}>Prepend to all prompts</MenuItem>
                                    <MenuItem value={"template"}>Template mode: insert all prompts at [prompt]</MenuItem>
                                </TextField>
                            </Box>
                        
                        </Grid>
                        <Grid xs={6} style={{ margin: 0, padding: 0 }}>
                            {promptInput(-1, true)}
                        </Grid>
                        <Grid xs={6} style={{ margin: 0, padding: 0 }}>
                            {promptInput(-1, false)}
                        </Grid>
                    </Grid>
                    { promptWarning ? <Alert severity="warning">{promptWarning}</Alert> : <></> }
                </Box>
            }
        </Grid>
        , [delPrompt, promptInput, unsavedPrompts, props, displayFadeOptions, composableDiffusionWarning, commitChanges, promptWarning, theme]);


    const reorderPrompts = useCallback(() => {
        unsavedPrompts.promptList.sort((a, b) => a.from - b.from);
        unsavedPrompts.promptList = unsavedPrompts.promptList.map((prompt, idx) => ({
            ...prompt,
            name: "Prompt " + (idx + 1), // + " (was " + prompt.name.split('(')[0] + ")",
        }));
        commitChanges({ ...unsavedPrompts });

    }, [commitChanges, unsavedPrompts])

    const [openSpacePromptsDialog, setOpenSpacePromptsDialog] = useState(false);
    const [openImportPromptsDialog, setOpenImportPromptsDialog] = useState(false);
    const [spacePromptsLastFrame, setSpacePromptsLastFrame] = useState(props.lastFrame);
    const [spacePromptsOverlap, setSpacePromptsOverlap] = useState(0);

    // TODO: Not sure why this is necessary, but without it, spacePromptsLastFrame doesn't update when new props are passed in.
    // I thought it would always re-evaluate.
    useEffect(() => {
        setSpacePromptsLastFrame(props.lastFrame);
    }, [props.lastFrame]);

    const handleCloseSpacePromptsDialog = useCallback((e: any): void => {
        setOpenSpacePromptsDialog(false);
        if (e.target.id !== "space") {
            return;
        }

        const span = (spacePromptsLastFrame + 1) / unsavedPrompts.promptList.length;
        const newPrompts = { ...unsavedPrompts };
        newPrompts.promptList = unsavedPrompts.promptList.map((p, idx) => {
            const newPrompt = { ...p };
            newPrompt.from = Math.max(0, Math.ceil(idx * span - spacePromptsOverlap / 2));
            newPrompt.to = Math.min(props.lastFrame, Math.floor((idx + 1) * span + spacePromptsOverlap / 2));
            newPrompt.allFrames = false;
            newPrompt.overlap.type = spacePromptsOverlap > 0 ? 'linear' : 'none';
            newPrompt.overlap.inFrames = newPrompt.from <= 0 ? 0 : spacePromptsOverlap;
            newPrompt.overlap.outFrames = newPrompt.to >= props.lastFrame ? 0 : spacePromptsOverlap;
            return newPrompt;
        });
        commitChanges(newPrompts);

    }, [unsavedPrompts, commitChanges, spacePromptsLastFrame, spacePromptsOverlap, props.lastFrame]);

    const spacePromptsDialog = useMemo(() => <Dialog open={openSpacePromptsDialog} onClose={handleCloseSpacePromptsDialog}>
        <DialogTitle>↔️ Evenly space prompts </DialogTitle>
        <DialogContent>
            <DialogContentText>
                Space all {unsavedPrompts.promptList.length} prompts evenly across the entire video, with optional fade between prompts.
                <br />
            </DialogContentText>
            <TextField
                type="number"
                size="small"
                style={{ marginTop: '10px', display: 'none' }}
                label={"Last frame"}
                inputProps={{ style: { fontFamily: 'Monospace', fontSize: '0.75em' } }}
                InputLabelProps={{ shrink: true, }}
                value={spacePromptsLastFrame}
                onChange={(e) => { setSpacePromptsLastFrame(parseInt(e.target.value)); }}
            />
            <TextField
                type="number"
                size="small"
                style={{ marginTop: '10px', width: '10em' }}
                label={"Fade frames"}
                inputProps={{ style: { fontFamily: 'Monospace', fontSize: '0.75em' } }}
                InputLabelProps={{ shrink: true, }}
                value={spacePromptsOverlap}
                onChange={(e) => { setSpacePromptsOverlap(parseInt(e.target.value)); }}
            />
            <Typography><small>This will overwrite the "From", "To" and "Fade" fields of all prompts.</small></Typography>
        </DialogContent>
        <DialogActions>
            <Button size="small" id="cancel_space" onClick={handleCloseSpacePromptsDialog}>Cancel</Button>
            <Button size="small" variant="contained" id="space" onClick={handleCloseSpacePromptsDialog}>↔️ Space</Button>
        </DialogActions>
    </Dialog>, [handleCloseSpacePromptsDialog, openSpacePromptsDialog, spacePromptsLastFrame, spacePromptsOverlap, unsavedPrompts.promptList.length]);



const [candidatePromptsToImport, setCandidatePromptsToImport] = useState<string>();
const [validatedPromptsToImport, setValidatedPromptsToImport] = useState<AdvancedParseqPrompt[]>([]);
const [validationMessage, setValidationMessage] = useState<JSX.Element>(<></>);

    const handleCloseImportPromptsDialog = useCallback((e: any): void => {    
        setOpenImportPromptsDialog(false);
        if (e.target.id !== "import") {
            return;
        }
        unsavedPrompts.promptList = [...unsavedPrompts.promptList, ...validatedPromptsToImport];
        commitChanges({...unsavedPrompts});
        setCandidatePromptsToImport(undefined);
        setValidatedPromptsToImport([]);
        setValidationMessage(<></>);
    }, [unsavedPrompts, commitChanges, validatedPromptsToImport]);

    // Validate candidate importable prompts 
    useDebouncedEffect(() => {
        if (candidatePromptsToImport === undefined) {
            setValidatedPromptsToImport([]);
            return;
        }
        try {
            //Relaxed JSON parser
            const parsedPrompts = JSON5.parse(candidatePromptsToImport||"");
            try {
                const prompts : AdvancedParseqPrompt[] = [];                

                //eslint-disable-next-line @typescript-eslint/no-unused-vars
                let {nextPromptIndex, nextPromptNameNumber} = getNextPromptIndex();
                for (const [key, value] of Object.entries(parsedPrompts)) {
                    const startFrame = parseInt(key);
                    if (isNaN(startFrame) || typeof value !== 'string') {
                        throw new Error(`${key}:${value}`);                    
                    }
                    if (prompts.length > 0) {
                        prompts[prompts.length-1].to = startFrame-1;
                    }
                    const newPrompt = stringToPrompt(value, startFrame, undefined);
                    newPrompt.name = `Prompt ${nextPromptNameNumber++}`;
                    prompts.push(newPrompt);
                }
                if (prompts.length > 0) {
                    prompts[prompts.length-1].to = props.lastFrame;
                }

                setValidatedPromptsToImport(prompts);
                setValidationMessage(<Alert severity="info">Input will be treated as a JSON file with <strong>{prompts.length}</strong> new prompt{prompts.length===1?'':'s'}.</Alert>);

            } catch (e : any) {
                setValidatedPromptsToImport([]);
                setValidationMessage(<Alert severity="error">The input looks like JSON but has an issue with the following entry, which is not of the expected format <code>"&lt;number&gt;":"&lt;string&gt;"</code>: {e.message}</Alert>);
                return;
            }
        } catch (e) {
            // Data to import is not valid JSON, even using a relaxed parser.             
            // Is it trying to be?
            if (candidatePromptsToImport?.startsWith('{') || candidatePromptsToImport?.endsWith('}')) {
                setValidatedPromptsToImport([]);
                setValidationMessage(<Alert severity="error">The input looks like JSON but is not valid. Try putting it through a JSON validator, or remove the leading/trailing curly braces to treat as plain text.</Alert>);
                return;
            }

            // Treating as list of lines.
            const lines = candidatePromptsToImport?.split('\n').filter((line) => line && line.trim().length > 0);
            //eslint-disable-next-line @typescript-eslint/no-unused-vars
            let {nextPromptIndex, nextPromptNameNumber} = getNextPromptIndex();            
            const prompts = lines?.map((line, idx) => {
                const startFrame = Math.floor(idx * props.lastFrame/lines.length);
                const endFrame = Math.floor((idx+1) * props.lastFrame/lines.length)              
                const newPrompt = stringToPrompt(line, startFrame, endFrame);
                newPrompt.name = `Prompt ${nextPromptNameNumber++}`;
                return newPrompt;
            })
            setValidatedPromptsToImport(prompts);
            if (prompts.length>0) {
                setValidationMessage(<Alert severity="info">Input will be treated as plain list with <strong>{prompts.length}</strong> new prompt{prompts.length===1?'':'s'}.</Alert>);
            } else {
                setValidationMessage(<></>);
            }

        }
    }, 250, [candidatePromptsToImport]);

    const importPromptsDialog = useMemo(() => <Dialog  maxWidth='md' fullWidth={true} open={openImportPromptsDialog} onClose={handleCloseImportPromptsDialog}>
        <DialogTitle>⬇️ Import prompts</DialogTitle>
        <DialogContent>
            <DialogContentText>
                <p>Paste in a Deforum-style JSON object, or a simple list of prompts separated by newlines. Postive and negative prompts will be split around <code>--neg</code>. These prompts will be added to your existing prompts (nothing will be removed).</p>
            </DialogContentText>
                <TextField
                        style={{ width: '100%' }}
                        multiline
                        onFocus={event => event.target.select()}
                        rows={10}
                        InputProps={{ style: { fontFamily: 'Monospace', fontSize: '0.75em' } }}
                        placeholder="<Paste your prompts here>"
                        value={candidatePromptsToImport}
                        onChange={(e) => setCandidatePromptsToImport(e.target.value)}
                    />
                {validationMessage}
        </DialogContent>
        <DialogActions>
            <Button size="small" id="cancel_space" onClick={handleCloseImportPromptsDialog}>Cancel</Button>
            <Button size="small" disabled={validatedPromptsToImport.length<1} variant="contained" id="import" onClick={handleCloseImportPromptsDialog}>⬇️ Import</Button>
        </DialogActions>
    </Dialog>, [openImportPromptsDialog, handleCloseImportPromptsDialog, candidatePromptsToImport, validationMessage, validatedPromptsToImport])

    const [timelineWidth, setTimelineWidth] = useState(600);
    const timelineRef = useRef<any>(null);
    const timeline = useMemo(() => {
        const data: TimelineRow[] = unsavedPrompts.promptList.map((p, idx) => ({
            id: idx.toString(),
            actions: [
                {
                    id: p.name,
                    start: p.allFrames ? 0 : p.from,
                    end: p.allFrames ? props.lastFrame : p.to,
                    effectId: "effect0",
                },
            ],

        }));

        const effects: Record<string, TimelineEffect> = {
            effect0: {
                id: "effect0",
                name: "Zero",
            },
            effect1: {
                id: "effect1",
                name: "One",
            },
        };

        // scale to 1/25th of frame length and round to nearest 5 
        const scale = Math.ceil(props.lastFrame / 25 / 5) * 5;
        const scaleWidth = timelineWidth / ((props.lastFrame * 1.1) / scale);
        //console.log("re-rendering with", timelineWidth, scale, scaleWidth);

        return (
            <span ref={timelineRef}>
                <Timeline
                    style={{ height: (50 + Math.min(unsavedPrompts.promptList.length, 4) * 25) + 'px', width: '100%' }}
                    editorData={data}
                    effects={effects}
                    scale={scale}
                    scaleWidth={scaleWidth}
                    rowHeight={15}
                    gridSnap={true}
                    onChange={(e: any) => {
                        const newPrompts = { ...unsavedPrompts };
                        newPrompts.promptList = unsavedPrompts.promptList.map((p, idx) => {
                            const action = e[idx].actions.find((a: any) => a.id === p.name);
                            p.from = Math.round(action.start);
                            p.to = Math.round(action.end);
                            return p;
                        });
                        commitChanges(newPrompts);
                    }}
                    getActionRender={(action: any, row: any) => {
                        return <div style={{ borderRadius: '5px', marginTop: '1px', overflow: 'hidden', maxHeight: '15px', backgroundColor: 'rgba(125,125,250,0.5)' }}>
                            <Typography paddingLeft={'5px'} color={'white'} fontSize='0.7em'>
                                {`${action.id}: ${action.start.toFixed(0)}-${action.end.toFixed(0)}`}
                            </Typography>
                        </div>
                    }}
                    getScaleRender={(scale: number) => scale < props.lastFrame ?
                        <Typography fontSize={'0.75em'}>{scale}</Typography>
                        : scale === props.lastFrame ?
                            <Typography fontSize={'0.75em'} color='orange'>{scale}</Typography>
                            : <Typography fontSize={'0.75em'} color='red'>{scale}</Typography>}
                    onCursorDrag={(e: any) => {
                        setQuickPreviewPosition(Math.round(e));
                    }}
                    onClickTimeArea={(time: number, e: any): boolean => {
                        setQuickPreviewPosition(Math.round(time));
                        return true;
                    }}
                />
            </span>
        );

    }, [commitChanges, unsavedPrompts, props, timelineWidth]);

    useEffect((): any => {
        function handleResize() {
            if (timelineRef.current) {
                setTimelineWidth(timelineRef.current.offsetWidth);
            }
            //console.log("resized to", timelineRef.current.offsetWidth);
        }
        handleResize();
        window.addEventListener('resize', handleResize)
        return (_: any) => window.removeEventListener('resize', handleResize);
    }, []);

    // update the quick preview when the cursor is dragged or prompts change
    useEffect(() => {
        const f = quickPreviewPosition;
        const activePrompts = unsavedPrompts.promptList.filter(p => p.allFrames || (f >= p.from && f <= p.to));

        let preview = '';
        if (activePrompts.length === 0) {
            preview = '⚠️ No prompt';
        } else if (activePrompts.length === 1) {
            preview = activePrompts[0].name.replace(' ', '_');
        } else {
            preview = activePrompts
                .map(p => `${p.name.replace(' ', '_')} : ${calculateWeight(p, f, props.lastFrame)}`)
                .join(' AND ');
        }

        setQuickPreview(preview);
    }, [unsavedPrompts, quickPreviewPosition, props.lastFrame]);

    function setPromptsEnabled(enabled: boolean) {
        unsavedPrompts.enabled = enabled;
        commitChanges({ ...unsavedPrompts });
    }

    function isPromptsEnabled(): boolean {
        return typeof (unsavedPrompts.enabled) === 'undefined' || unsavedPrompts.enabled;
    }

    return <Grid xs={12} container style={{ margin: 0, padding: 0 }}>
        <Grid xs={12} sx={{ paddingTop: '0', paddingBottom: '0' }}>
            <Stack direction={'row'} gap={1} alignItems={"center"} >
                <Tooltip title="Disable to control prompts with Deforum instead.">
                    <FormControlLabel
                        sx={{ padding: '0' }}
                        control={<StyledSwitch
                            onChange={(e) => { setPromptsEnabled(e.target.checked) }}
                            checked={isPromptsEnabled()} />}
                        label={<small> Use Parseq to manage prompts.</small>} />
                </Tooltip>
                {isPromptsEnabled() ?  <>
                <Button size="small" variant="outlined" onClick={addPrompt}>➕ Add prompts</Button>
                <Button size="small" disabled={unsavedPrompts.promptList.length < 2} variant="outlined" onClick={() => setOpenSpacePromptsDialog(true)}>↔️ Evenly space prompts</Button>
                <Tooltip title="Re-order and rename prompts based on their starting frame">
                    <span><Button size="small" disabled={unsavedPrompts.promptList.length < 2} variant="outlined" onClick={() => reorderPrompts()}>⇵ Reorder prompts</Button></span>
                </Tooltip>
                <Tooltip title="Import a list of prompts">
                    <span><Button size="small" variant="outlined" onClick={() => setOpenImportPromptsDialog(true)}>⬇️ Import prompts</Button></span>
                </Tooltip>
                </> : <></>}
            </Stack>                
        </Grid>
        {isPromptsEnabled() ? <>
            {displayPrompts(unsavedPrompts)}
            {spacePromptsDialog}
            {importPromptsDialog}
            <Grid xs={4} sx={{ paddingRight: '15px', paddingTop: '25px' }} >
                <Tooltip title="Quickly see which prompts will be used at each frame, and whether they will be composed. To see the full rendered prompts, use the main preview below." >
                    <Stack>
                        <TextField
                            multiline
                            minRows={2}
                            maxRows={16}
                            size="small"
                            fullWidth={true}
                            InputLabelProps={{ shrink: true }}
                            InputProps={{ readOnly: true, style: { fontFamily: 'Monospace', fontSize: '0.75em',  } }}
                            value={quickPreview}
                            label={`Quick preview [frame ${quickPreviewPosition} / beat ${frameToBeat(quickPreviewPosition, props.fps, props.bpm).toFixed(2)} / ${frameToSec(quickPreviewPosition, props.fps).toFixed(2)}s]`}
                            variant="outlined"
                        />
                    </Stack>
                </Tooltip>
            </Grid>
            <Grid xs={8} sx={{ paddingTop: '25px' }} >
                {timeline}
            </Grid>
        </> : <></>
        }
    </Grid>


}


export function calculateWeight(p: AdvancedParseqPrompt, f: number, lastFrame: number) {

    switch (p.overlap.type) {
        case "linear":
            const promptStart = p.allFrames ? 0 : p.from;
            const promptEnd = p.allFrames ? lastFrame : p.to;
            if (p.overlap.inFrames && f < (promptStart + p.overlap.inFrames)) {
                const fadeOffset = f - promptStart;
                const fadeRatio = fadeOffset / p.overlap.inFrames;
                return fadeRatio.toPrecision(4);
            } else if (p.overlap.outFrames && f > (promptEnd - p.overlap.outFrames)) {
                const fadeOffset = f - (promptEnd - p.overlap.outFrames);
                const fadeRatio = fadeOffset / p.overlap.outFrames;
                return (1 - fadeRatio).toPrecision(4);
            } else {
                return '1';
            }
        case "custom":
            return "${" + p.overlap.custom + "}";
        default:
            return '1';
    }

}